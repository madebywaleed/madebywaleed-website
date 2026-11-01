// Domain availability lookups for the Username Checker.
// Only /api/domain is handled here; everything else is served from the static assets.

const TLDS = ["com","net","org","io","co","app","ai","xyz","info","biz","tech","store","shop","blog","media","studio","design","dev","me","online"];
const ALLOWED = new Set(TLDS);
const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/domain") {
      return env.ASSETS.fetch(request);
    }
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
    }

    const name = (url.searchParams.get("name") || "").toLowerCase();
    const tld = (url.searchParams.get("tld") || "").toLowerCase();
    if (!NAME_RE.test(name)) return json({ error: "invalid_name" }, 400);
    if (!ALLOWED.has(tld)) return json({ error: "invalid_tld" }, 400);

    const domain = `${name}.${tld}`;
    const cache = caches.default;
    const cacheKey = new Request(`https://cache.internal/domain/${domain}`);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    // "available" = the registry says the domain is not registered.
    // "registered" = the registry has a record for it.
    // "unknown" = the lookup failed or timed out, so we don't guess.
    let status = "unknown";
    try {
      const r = await fetch(`https://rdap.org/domain/${domain}`, {
        headers: { accept: "application/rdap+json, application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(6000),
      });
      if (r.status === 200) status = "registered";
      else if (r.status === 404) status = "available";
    } catch (e) {
      status = "unknown";
    }

    const res = json({ domain, status, checked: new Date().toISOString() }, 200, {
      "cache-control": "public, max-age=600",
    });
    // Only cache real answers, so a timeout is retried next time.
    if (status !== "unknown") await cache.put(cacheKey, res.clone());
    return res;
  },
};
