// Email authentication lookups for the Email Checker (SPF, DKIM, DMARC, MX).
// Records come from Cloudflare's DNS-over-HTTPS JSON API. Nothing is stored.

const DOH = "https://cloudflare-dns.com/dns-query";
const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const SELECTOR_RE = /^[a-z0-9](?:[a-z0-9._-]{0,61}[a-z0-9])?$/;
const COMMON_SELECTORS = [
  "default", "google", "selector1", "selector2", "k1", "k2",
  "s1", "s2", "mail", "dkim", "mandrill", "smtp",
];

async function dohQuery(name, type) {
  const r = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error("doh_" + r.status);
  const body = await r.json();
  // Status 0 = NOERROR, 3 = NXDOMAIN (no such name). Anything else is a failed lookup.
  if (body.Status !== 0 && body.Status !== 3) throw new Error("doh_status_" + body.Status);
  return (body.Answer || []).filter((a) => a.type === (type === "TXT" ? 16 : 15));
}

// TXT answers may be split into quoted chunks; join them back into one string.
function txtValue(data) {
  const chunks = data.match(/"((?:[^"\\]|\\.)*)"/g);
  if (!chunks) return data;
  return chunks.map((c) => c.slice(1, -1).replace(/\\(.)/g, "$1")).join("");
}

async function txtRecords(name) {
  try {
    return (await dohQuery(name, "TXT")).map((a) => txtValue(a.data));
  } catch {
    return null; // null = lookup failed, so we don't claim the record is missing
  }
}

// Counts the SPF mechanisms that trigger extra DNS lookups (RFC 7208 limit is 10).
function spfLookupCount(spf) {
  return spf.split(/\s+/).slice(1).filter((t) =>
    /^[+\-~?]?(include:|a(\/|$)|mx(\/|$)|ptr(\/|$)|exists:|redirect=)/i.test(t)
  ).length;
}

function analyze(d) {
  const findings = [];
  const add = (check, level, title, detail) => findings.push({ check, level, title, detail });

  // SPF
  const spfs = (d.spf || []).filter((r) => /^v=spf1(\s|$)/i.test(r));
  if (d.spf === null) {
    add("spf", "warn", "SPF could not be checked", "The DNS lookup failed. Try again in a few minutes.");
  } else if (spfs.length === 0) {
    add("spf", "fail", "No SPF record", "Add a TXT record that starts with v=spf1 and lists the services that send mail for this domain.");
  } else if (spfs.length > 1) {
    add("spf", "fail", "More than one SPF record", "Receivers reject a domain with two SPF records. Merge them into one.");
  } else {
    const spf = spfs[0];
    const lookups = spfLookupCount(spf);
    if (lookups > 10) {
      add("spf", "fail", `SPF needs ${lookups} DNS lookups (limit is 10)`, "Receivers treat SPF as failed above 10 lookups. Remove unused include: entries or flatten the record.");
    } else {
      add("spf", "pass", `SPF record found (${lookups}/10 lookups)`, "The record is valid and within the lookup limit.");
    }
    const all = (spf.match(/([+\-~?]?)all\b/i) || [])[1];
    if (all === "+") add("spf", "fail", "SPF ends in +all", "+all lets anyone send mail as this domain. Change it to -all or ~all.");
    else if (all === "?") add("spf", "warn", "SPF ends in ?all (neutral)", "Neutral does not protect the domain. Use -all, or ~all while you test.");
    else if (all === "~") add("spf", "pass", "SPF uses soft fail (~all)", "Good. Switch to -all once you are sure every sender is listed.");
    else if (all === "-") add("spf", "pass", "SPF uses hard fail (-all)", "Good. Only the senders you list are allowed.");
    else add("spf", "warn", "SPF has no all mechanism", "Add -all or ~all at the end so unlisted senders are handled.");
  }

  // DMARC
  const dmarcs = (d.dmarc || []).filter((r) => /^v=DMARC1(;|\s|$)/i.test(r));
  if (d.dmarc === null) {
    add("dmarc", "warn", "DMARC could not be checked", "The DNS lookup failed. Try again in a few minutes.");
  } else if (dmarcs.length === 0) {
    add("dmarc", "fail", "No DMARC record", "Add a TXT record at _dmarc with v=DMARC1; p=none; rua=mailto:you@yourdomain to start getting reports.");
  } else {
    const rec = dmarcs[0];
    const policy = ((rec.match(/(?:^|;)\s*p=(\w+)/i) || [])[1] || "").toLowerCase();
    if (policy === "reject") add("dmarc", "pass", "DMARC policy is reject", "Mail that fails SPF and DKIM alignment is rejected. This is the strongest setting.");
    else if (policy === "quarantine") add("dmarc", "pass", "DMARC policy is quarantine", "Failing mail goes to spam. You can move to reject later.");
    else if (policy === "none") add("dmarc", "warn", "DMARC policy is none (monitor only)", "Reports are collected, but nothing is blocked. Move to quarantine or reject once the reports look clean.");
    else add("dmarc", "fail", "DMARC has no valid p= policy", "Add p=none, p=quarantine or p=reject.");
    if (!/(?:^|;)\s*rua=/i.test(rec)) add("dmarc", "warn", "No aggregate report address", "Add rua=mailto:you@yourdomain so you receive reports about who sends mail as your domain.");
  }

  // DKIM
  if (d.dkim === null) {
    add("dkim", "warn", "DKIM could not be checked", "The DNS lookup failed. Try again in a few minutes.");
  } else {
    const found = Object.entries(d.dkim).filter(([, recs]) => recs && recs.some((r) => /v=DKIM1|p=/i.test(r)));
    if (found.length) {
      add("dkim", "pass", `DKIM key found (${found.map(([s]) => s).join(", ")})`, "A signing key is published. Mail signed with it can pass DKIM.");
    } else {
      add("dkim", "warn", "No DKIM key found for common selectors", "DKIM selectors are set by your mail provider. If you know yours, enter it above to check it.");
    }
  }

  // MX
  if (d.mx === null) {
    add("mx", "warn", "MX could not be checked", "The DNS lookup failed. Try again in a few minutes.");
  } else if (d.mx.length === 0 || d.mx.every((m) => m.host === ".")) {
    add("mx", "info", "Domain does not receive mail", "No MX record is set. That is fine for a site that never sends or receives email, and an SPF of v=spf1 -all helps block spoofing.");
  } else {
    add("mx", "pass", `Mail servers found (${d.mx.length})`, "The domain can receive mail.");
  }

  return findings;
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

export async function handleEmail(request, env) {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
  const url = new URL(request.url);
  const domain = (url.searchParams.get("domain") || "").trim().toLowerCase().replace(/\.$/, "");
  const extra = (url.searchParams.get("selector") || "").trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) return json({ error: "invalid_domain" }, 400);
  if (extra && !SELECTOR_RE.test(extra)) return json({ error: "invalid_selector" }, 400);

  const selectors = [...new Set([...(extra ? [extra] : []), ...COMMON_SELECTORS])];
  const cache = caches.default;
  const cacheKey = new Request(`https://cache.internal/email/${domain}/${extra}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const [spf, dmarc, mx, ...dkimRecs] = await Promise.all([
    txtRecords(domain),
    txtRecords(`_dmarc.${domain}`),
    dohQuery(domain, "MX").then(
      (a) => a.map((r) => {
        const [pref, host] = r.data.split(/\s+/);
        return { preference: Number(pref), host: host.replace(/\.$/, "") || "." };
      }),
      () => null
    ),
    ...selectors.map((s) => txtRecords(`${s}._domainkey.${domain}`)),
  ]);

  const dkim = {};
  selectors.forEach((s, i) => {
    dkim[s] = dkimRecs[i];
  });
  const allDkimFailed = dkimRecs.every((r) => r === null);

  const data = {
    domain,
    spf,
    dmarc,
    mx,
    dkim: allDkimFailed ? null : dkim,
  };
  const result = { ...data, findings: analyze(data), checked: new Date().toISOString() };

  const res = json(result, 200, { "cache-control": "public, max-age=600" });
  // Cache only complete answers, so a temporary DNS failure is retried next time.
  if (spf !== null && dmarc !== null && mx !== null && !allDkimFailed) await cache.put(cacheKey, res.clone());
  return res;
}

export { analyze, txtValue, spfLookupCount };
