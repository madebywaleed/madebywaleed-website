/* LmarSys analytics: range tabs, power chart, energy bars and totals.
 * Self-contained (no libraries). Used by the PC dashboard and the website demo.
 *
 *   var a = LmarAnalytics.mount(rootElement, { fetchStats: function (range) { return Promise<stats>; },
 *                                              csvUrl: function (range) { return "/api/export.csv?range=" + range; } });
 *   a.setSource(newFetchFn, newCsvFn);   // switch between real data and the demo
 *   a.refresh();
 */
(function (global) {
  "use strict";

  var COLORS = { solar: "#fbbf24", load: "#c084fc", grid: "#60a5fa", batt: "#34d399", soc: "#f472b6", exp: "#2dd4bf" };
  var RANGE_LIST = [["60m", "60 min"], ["1d", "1 day"], ["1w", "1 week"], ["1m", "1 month"], ["1y", "1 year"], ["all", "All time"]];
  var SERIES = [["solar", "Solar"], ["load", "Home"], ["grid", "Grid (+import)"], ["batt", "Battery (+discharge)"], ["soc", "Battery %"]];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var CSS = [
    ".lma .an-head{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:12px}",
    ".lma .an-title{margin:0;font-size:.78rem;text-transform:uppercase;letter-spacing:1.2px;color:#8d97b3;font-weight:600}",
    ".lma .tabs{display:flex;flex-wrap:wrap;gap:6px}",
    ".lma .tab,.lma .chip{font:inherit;font-size:.8rem;color:#8d97b3;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.13);border-radius:999px;padding:6px 13px;cursor:pointer}",
    ".lma .tab.on{color:#e8ecf6;background:rgba(139,92,246,.35);border-color:rgba(167,139,250,.6)}",
    ".lma .chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}",
    ".lma .chip{display:inline-flex;align-items:center;gap:7px;padding:5px 12px;color:#e8ecf6}",
    ".lma .chip i{width:10px;height:10px;border-radius:50%;display:inline-block;background:var(--c)}",
    ".lma .chip.off{opacity:.45}.lma .chip.off i{background:transparent;box-shadow:inset 0 0 0 1.5px var(--c)}",
    ".lma .cbox{position:relative;height:300px}.lma .cbox.short{height:210px}",
    ".lma canvas{width:100%;height:100%;display:block}",
    ".lma .tip{position:absolute;display:none;pointer-events:none;z-index:5;padding:8px 11px;font-size:.78rem;line-height:1.55;border-radius:10px;background:rgba(10,15,30,.95);border:1px solid rgba(255,255,255,.18);white-space:nowrap;color:#e8ecf6}",
    ".lma .note{margin-top:10px;color:#8d97b3;font-size:.78rem}.lma .note a{color:#a5b4fc}",
    ".lma h3{margin:20px 0 8px;font-size:.78rem;text-transform:uppercase;letter-spacing:1.2px;color:#8d97b3;font-weight:600}",
    ".lma .totals{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:12px}",
    ".lma .total{padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.13)}",
    ".lma .total span{display:block;font-size:.72rem;color:#8d97b3;margin-bottom:3px}",
    ".lma .total b{font-size:1.25rem;font-weight:650;color:#e8ecf6}.lma .total small{font-size:.78rem;font-weight:500;color:#8d97b3;margin-left:3px}",
    ".lma .empty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:20px;color:#8d97b3;font-size:.86rem}"
  ].join("\n");

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtKwh(v) { if (v === null || v === undefined) return "--"; var a = Math.abs(v); return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2); }
  function fmtW(w) { var a = Math.abs(w); return a >= 1000 ? (w / 1000).toFixed(2) + " kW" : Math.round(w) + " W"; }
  function localOff() { return -new Date().getTimezoneOffset() * 60; }

  function timeTicks(x0, x1, maxN) {
    var span = x1 - x0;
    var steps = [300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800, 604800, 1209600, 2592000, 7776000, 15552000, 31536000];
    var step = steps[steps.length - 1];
    for (var i = 0; i < steps.length; i++) { if (span / steps[i] <= maxN) { step = steps[i]; break; } }
    var off = localOff(), t = Math.ceil((x0 + off) / step) * step - off, out = [];
    for (; t <= x1; t += step) out.push(t);
    return { ticks: out, step: step };
  }
  function tickLabel(t, step) {
    var d = new Date(t * 1000);
    if (step < 86400) return d.getHours() === 0 && d.getMinutes() === 0 ? d.getDate() + " " + MON[d.getMonth()] : pad(d.getHours()) + ":" + pad(d.getMinutes());
    if (step < 2592000) return d.getDate() + " " + MON[d.getMonth()];
    return MON[d.getMonth()] + " " + String(d.getFullYear()).slice(2);
  }
  function fullTime(t, bucket) {
    var d = new Date(t * 1000), day = d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear();
    if (bucket < 86400) return day + ", " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    if (bucket === 86400) return day;
    return "Week of " + day;
  }
  function bucketName(s) {
    if (s < 3600) return s / 60 + (s === 60 ? " minute" : " minutes");
    if (s < 86400) return s / 3600 + (s === 3600 ? " hour" : " hours");
    return s / 86400 + (s === 86400 ? " day" : " days");
  }
  function niceScale(min, max, n) {
    if (max <= min) max = min + 1;
    var raw = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    return { min: Math.floor(min / step + 1e-9) * step, max: Math.ceil(max / step - 1e-9) * step, step: step };
  }
  function prep(cv) {
    var dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    var w = Math.max(120, r.width), h = Math.max(120, r.height);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c: c, w: w, h: h };
  }

  // ---------------------------------------------------------------- demo data
  function demoStats(range) {
    var now = Math.floor(Date.now() / 1000), off = localOff();
    var CFG = { "60m": [3600, 60, 0], "1d": [86400, 300, 3600], "1w": [604800, 1800, 86400], "1m": [2592000, 7200, 86400], "1y": [31536000, 86400, 604800], "all": [34560000, 86400, 604800] };
    var c = CFG[range] || CFG["1d"], span = c[0], bucket = c[1], eb = c[2], start = now - span;
    function frac(x) { return x - Math.floor(x); }
    function g(h, m, s) { return Math.exp(-Math.pow((h - m) / s, 2)); }
    function sample(t) {
      var d = new Date(t * 1000), h = d.getHours() + d.getMinutes() / 60, day = Math.floor((t + off) / 86400);
      var cloud = 0.45 + 0.55 * frac(Math.sin(day * 12.9898) * 43758.5453);
      var season = 0.75 + 0.25 * Math.cos(2 * Math.PI * ((day % 365) - 172) / 365);
      var solar = (h < 6 || h > 18.2) ? 0 : 5200 * season * cloud * Math.pow(Math.sin(Math.PI * (h - 6) / 12.2), 1.4) + Math.sin(t / 900) * 140 * cloud;
      solar = Math.max(0, solar);
      var load = 480 + 760 * g(h, 14, 2.6) + 950 * g(h, 20.5, 2) + 180 * g(h, 7.5, 1) + Math.sin(t / 700) * 120;
      var hh = h < 7 ? h + 24 : h, soc, slope;
      if (hh >= 18) { soc = 95 - (hh - 18) * (60 / 13); slope = -60 / 13; }
      else { soc = 35 + (hh - 7) * (65 / 6); slope = 65 / 6; if (soc > 100) { soc = 100; slope = 0; } }
      var batt = -slope * 100;               // + discharge
      var grid = load - solar - batt;
      return { solar: solar, load: load, grid: grid, batt: batt, soc: soc };
    }
    function build(b, step) {
      var rows = [], first = Math.ceil((start + off) / b) * b - off;
      for (var t = first; t <= now; t += b) {
        var n = Math.max(1, Math.round(b / step)), a = { solar: 0, load: 0, grid: 0, batt: 0, soc: 0, sm: 0, lm: 0, imp: 0, exp: 0, chg: 0, dis: 0 };
        for (var i = 0; i < n; i++) {
          var s = sample(t + (i + 0.5) * (b / n)), k = (b / n) / 3600;
          a.solar += s.solar; a.load += s.load; a.grid += s.grid; a.batt += s.batt; a.soc += s.soc;
          a.sm = Math.max(a.sm, s.solar); a.lm = Math.max(a.lm, s.load);
          a.imp += Math.max(s.grid, 0) * k; a.exp += Math.max(-s.grid, 0) * k; a.chg += Math.max(-s.batt, 0) * k; a.dis += Math.max(s.batt, 0) * k;
        }
        rows.push({ t: t, solar: a.solar / n, load: a.load / n, grid: a.grid / n, batt: a.batt / n, soc: a.soc / n, solar_max: a.sm, load_max: a.lm,
          _sk: a.solar / n * b / 3600000, _lk: a.load / n * b / 3600000, imp: a.imp / 1000, exp: a.exp / 1000, chg: a.chg / 1000, dis: a.dis / 1000 });
      }
      return rows;
    }
    var pts = build(bucket, Math.max(60, Math.min(bucket, 900)));
    var energy = [];
    if (eb) energy = build(eb, 900).map(function (r) { return { t: r.t, solar: r._sk, load: r._lk, imp: r.imp, exp: r.exp, chg: r.chg, dis: r.dis }; });
    var src = energy.length ? energy : pts.map(function (r) { return { solar: r._sk, load: r._lk, imp: r.imp, exp: r.exp, chg: r.chg, dis: r.dis }; });
    var tot = { solar: 0, load: 0, imp: 0, exp: 0, chg: 0, dis: 0 }, ps = 0, pl = 0;
    src.forEach(function (r) { for (var k in tot) tot[k] += r[k]; });
    pts.forEach(function (r) { ps = Math.max(ps, r.solar_max); pl = Math.max(pl, r.load_max); });
    tot.self_sufficiency_pct = Math.round(Math.max(0, Math.min(100, (tot.load - tot.imp) / tot.load * 100)) * 10) / 10;
    tot.solar_used_pct = tot.solar > 0 ? Math.round(Math.max(0, Math.min(100, (tot.solar - tot.exp) / tot.solar * 100)) * 10) / 10 : null;
    tot.peak_solar_w = ps; tot.peak_load_w = pl; tot.coverage_pct = 100;
    return { range: range, start: start, end: now, bucket_s: bucket, energy_bucket_s: eb, points: pts, energy: energy, totals: tot, demo: true };
  }

  // ---------------------------------------------------------------- mount
  function mount(root, opts) {
    if (!document.getElementById("lma-css")) {
      var st = document.createElement("style"); st.id = "lma-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    root.classList.add("lma");
    var range = "1d";
    try { range = localStorage.getItem("lmarsysRange") || "1d"; } catch (e) {}
    if (!RANGE_LIST.some(function (r) { return r[0] === range; })) range = "1d";
    var on = { solar: true, load: true, grid: false, batt: false, soc: false };
    var fetchStats = opts.fetchStats, csvUrl = opts.csvUrl, data = null, hover = -1, hover2 = -1, token = 0;

    root.innerHTML =
      '<div class="an-head"><h2 class="an-title">Analytics</h2><div class="tabs" data-r="tabs"></div></div>' +
      '<div class="chips" data-r="chips"></div>' +
      '<div class="cbox"><canvas data-r="line"></canvas><div class="tip" data-r="tip"></div><div class="empty" data-r="empty" style="display:none"></div></div>' +
      '<div class="note" data-r="note"></div>' +
      '<div data-r="energy"><h3>Energy per period (kWh)</h3><div class="chips" data-r="legend"></div>' +
      '<div class="cbox short"><canvas data-r="bars"></canvas><div class="tip" data-r="tip2"></div></div></div>' +
      '<h3>Totals for this period</h3><div class="totals" data-r="totals"></div>' +
      '<div class="note"><a data-r="csv" href="#" download>Download this period as CSV</a><span data-r="csvnote"> &middot; History is saved on this computer and only grows while the program is running.</span></div>';
    function q(n) { return root.querySelector('[data-r="' + n + '"]'); }
    var tabs = q("tabs"), chips = q("chips"), line = q("line"), bars = q("bars"), tip = q("tip"), tip2 = q("tip2"), empty = q("empty");

    RANGE_LIST.forEach(function (r) {
      var b = document.createElement("button"); b.type = "button"; b.className = "tab"; b.textContent = r[1]; b.dataset.range = r[0];
      b.addEventListener("click", function () { range = r[0]; try { localStorage.setItem("lmarsysRange", range); } catch (e) {} load(); });
      tabs.appendChild(b);
    });
    SERIES.forEach(function (s) {
      var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.style.setProperty("--c", COLORS[s[0]]);
      b.innerHTML = "<i></i>" + s[1]; b.dataset.key = s[0];
      b.addEventListener("click", function () { on[s[0]] = !on[s[0]]; hover = -1; drawAll(); });
      chips.appendChild(b);
    });
    var legend = q("legend");
    [["solar", "Solar made"], ["load", "Home used"], ["imp", "Grid imported"]].forEach(function (s) {
      var b = document.createElement("span"); b.className = "chip"; b.style.setProperty("--c", s[0] === "imp" ? COLORS.grid : COLORS[s[0]]); b.style.cursor = "default";
      b.innerHTML = "<i></i>" + s[1]; legend.appendChild(b);
    });

    function load() {
      var my = ++token;
      [].forEach.call(tabs.children, function (b) { b.classList.toggle("on", b.dataset.range === range); });
      q("csv").href = csvUrl ? csvUrl(range) : "#";
      q("csv").style.display = csvUrl ? "" : "none";
      q("csvnote").style.display = csvUrl ? "" : "none";
      Promise.resolve(fetchStats(range)).then(function (d) {
        if (my !== token) return;
        data = d; hover = -1; hover2 = -1; drawAll();
      }).catch(function () {
        if (my !== token) return;
        data = null; showEmpty("Could not load history. Is the program still running?");
      });
    }
    function showEmpty(msg) {
      empty.style.display = ""; empty.textContent = msg;
      var c = prep(line); c.c.clearRect(0, 0, c.w, c.h);
    }

    // ------------------------------------------------ power chart
    var geo = null;
    function drawLine() {   // axes only; series are drawn by drawLineFull
      [].forEach.call(chips.children, function (b) { b.classList.toggle("off", !on[b.dataset.key]); });
      if (!data || !data.points.length) {
        showEmpty("No history yet. LmarSys saves a reading every few seconds while it is running, and this chart fills in over time.");
        geo = null; return;
      }
      empty.style.display = "none";
      var p = data.points, ctx = prep(line), c = ctx.c, W = ctx.w, H = ctx.h;
      var L = 52, R = on.soc ? 42 : 14, T = 12, B = 26, pw = W - L - R, ph = H - T - B;
      var x0 = data.start, x1 = Math.max(data.end, p[p.length - 1].t + data.bucket_s);
      if (data.range === "all") x0 = Math.min(x0, p[0].t);
      var ymin = 0, ymax = 0, any = false;
      ["solar", "load", "grid", "batt"].forEach(function (k) {
        if (!on[k]) return;
        any = true;
        p.forEach(function (r) { if (r[k] < ymin) ymin = r[k]; if (r[k] > ymax) ymax = r[k]; });
      });
      if (!any || (ymax === 0 && ymin === 0)) ymax = 1000;
      var ys = niceScale(ymin, ymax * 1.05, 5);
      function X(t) { return L + (t - x0) / (x1 - x0) * pw; }
      function Y(v) { return T + (1 - (v - ys.min) / (ys.max - ys.min)) * ph; }
      function YS(v) { return T + (1 - v / 100) * ph; }
      c.clearRect(0, 0, W, H);
      c.font = "11px system-ui, sans-serif"; c.textBaseline = "middle";
      for (var v = ys.min; v <= ys.max + ys.step / 2; v += ys.step) {
        var y = Y(v);
        c.strokeStyle = Math.abs(v) < 1e-9 ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.07)"; c.lineWidth = 1;
        c.beginPath(); c.moveTo(L, y); c.lineTo(W - R, y); c.stroke();
        c.fillStyle = "#8d97b3"; c.textAlign = "right";
        c.fillText(Math.abs(v) >= 1000 ? (v / 1000) + "k" : Math.round(v), L - 8, y);
      }
      c.save(); c.translate(11, T + ph / 2); c.rotate(-Math.PI / 2); c.textAlign = "center"; c.fillStyle = "#8d97b3"; c.fillText("Watts", 0, 0); c.restore();
      if (on.soc) {
        c.textAlign = "left"; c.fillStyle = COLORS.soc;
        [0, 50, 100].forEach(function (v) { c.fillText(v + "%", W - R + 6, YS(v)); });
      }
      var tk = timeTicks(x0, x1, Math.max(3, Math.floor(pw / 85)));
      c.textAlign = "center"; c.textBaseline = "top";
      tk.ticks.forEach(function (t) {
        var x = X(t);
        c.strokeStyle = "rgba(255,255,255,.05)"; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke();
        c.fillStyle = "#8d97b3"; c.fillText(tickLabel(t, tk.step), x, T + ph + 7);
      });
      c.textBaseline = "middle";

      function draw(key, color, fillArea, dashed, mapY) {
        var runs = [], run = [];
        p.forEach(function (r, i) {
          if (run.length && r.t - p[i - 1].t > data.bucket_s * 2.5) { runs.push(run); run = []; }
          run.push(r);
        });
        if (run.length) runs.push(run);
        runs.forEach(function (rn) {
          c.beginPath();
          rn.forEach(function (r, i) { var x = X(r.t + data.bucket_s / 2), y = mapY(r[key]); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
          if (rn.length === 1) { c.arc(X(rn[0].t + data.bucket_s / 2), mapY(rn[0][key]), 2, 0, 7); c.fillStyle = color; c.fill(); return; }
          c.strokeStyle = color; c.lineWidth = 2; c.lineJoin = "round"; c.setLineDash(dashed ? [5, 4] : []); c.stroke(); c.setLineDash([]);
          if (fillArea) {
            c.lineTo(X(rn[rn.length - 1].t + data.bucket_s / 2), mapY(0)); c.lineTo(X(rn[0].t + data.bucket_s / 2), mapY(0)); c.closePath();
            var gr = c.createLinearGradient(0, T, 0, T + ph); gr.addColorStop(0, color + "55"); gr.addColorStop(1, color + "05");
            c.fillStyle = gr; c.fill();
          }
        });
      }
      geo = { X: X, Y: Y, YS: YS, L: L, R: R, T: T, ph: ph, W: W, x0: x0, x1: x1 };
      return { draw: draw, c: c };
    }
    function drawLineFull() {
      var h = drawLine();   // draws the axes and returns the series helper
      if (!h) return;
      var p = data.points;
      if (on.solar) h.draw("solar", COLORS.solar, true, false, geo.Y);
      if (on.load) h.draw("load", COLORS.load, true, false, geo.Y);
      if (on.grid) h.draw("grid", COLORS.grid, false, false, geo.Y);
      if (on.batt) h.draw("batt", COLORS.batt, false, false, geo.Y);
      if (on.soc) h.draw("soc", COLORS.soc, false, true, geo.YS);
      if (hover >= 0 && hover < p.length) {
        var r = p[hover], x = geo.X(r.t + data.bucket_s / 2), c = h.c;
        c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1; c.beginPath(); c.moveTo(x, geo.T); c.lineTo(x, geo.T + geo.ph); c.stroke();
        ["solar", "load", "grid", "batt"].forEach(function (k) { if (on[k]) dot(c, x, geo.Y(r[k]), COLORS[k]); });
        if (on.soc) dot(c, x, geo.YS(r.soc), COLORS.soc);
      }
      var note = "Each point is the average of " + bucketName(data.bucket_s) + ". ";
      var cov = data.totals && data.totals.coverage_pct;
      if (cov !== undefined && cov !== null && !data.demo) note += "Data covers " + cov + "% of this period; gaps are times the program was not running. ";
      if (data.demo) note += "Simulated numbers, not from a real inverter.";
      q("note").textContent = note;
    }
    function dot(c, x, y, col) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fillStyle = col; c.fill(); c.strokeStyle = "#0a0f1e"; c.lineWidth = 2; c.stroke(); }
    line.addEventListener("mousemove", function (e) {
      if (!data || !geo || !data.points.length) return;
      var r = line.getBoundingClientRect(), x = e.clientX - r.left, p = data.points, best = -1, bd = 1e9;
      for (var i = 0; i < p.length; i++) { var d = Math.abs(geo.X(p[i].t + data.bucket_s / 2) - x); if (d < bd) { bd = d; best = i; } }
      hover = bd < 40 ? best : -1; drawLineFull();
      if (hover < 0) { tip.style.display = "none"; return; }
      var pt = p[hover], html = "<b>" + fullTime(pt.t, data.bucket_s) + "</b>";
      SERIES.forEach(function (s) {
        if (!on[s[0]]) return;
        html += '<br><span style="color:' + COLORS[s[0]] + '">&#9679;</span> ' + s[1].replace(/ \(.*\)/, "") + ": " + (s[0] === "soc" ? Math.round(pt.soc) + " %" : fmtW(pt[s[0]]));
      });
      tip.innerHTML = html; tip.style.display = "block";
      var tx = geo.X(pt.t + data.bucket_s / 2) + 14;
      if (tx + tip.offsetWidth > r.width - 4) tx = geo.X(pt.t + data.bucket_s / 2) - tip.offsetWidth - 14;
      tip.style.left = Math.max(4, tx) + "px"; tip.style.top = "14px";
    });
    line.addEventListener("mouseleave", function () { hover = -1; tip.style.display = "none"; if (data) drawLineFull(); });

    // ------------------------------------------------ energy bars
    var bgeo = null;
    function drawBars() {
      var wrap = q("energy");
      if (!data || !data.energy || !data.energy.length) { wrap.style.display = "none"; bgeo = null; return; }
      wrap.style.display = "";
      var e = data.energy, ctx = prep(bars), c = ctx.c, W = ctx.w, H = ctx.h, L = 52, R = 14, T = 10, B = 26, pw = W - L - R, ph = H - T - B;
      var ymax = 0;
      e.forEach(function (r) { ymax = Math.max(ymax, r.solar, r.load, r.imp); });
      var ys = niceScale(0, (ymax || 1) * 1.05, 4);
      function Y(v) { return T + (1 - v / ys.max) * ph; }
      c.clearRect(0, 0, W, H); c.font = "11px system-ui, sans-serif"; c.textBaseline = "middle";
      for (var v = 0; v <= ys.max + ys.step / 2; v += ys.step) {
        c.strokeStyle = v === 0 ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.07)"; c.lineWidth = 1;
        c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(W - R, Y(v)); c.stroke();
        c.fillStyle = "#8d97b3"; c.textAlign = "right"; c.fillText(+v.toFixed(2), L - 8, Y(v));
      }
      var gw = pw / e.length, bw = Math.max(1.5, Math.min(18, gw / 3.5));
      var step = data.energy_bucket_s >= 86400 ? 86400 : 3600, every = Math.max(1, Math.ceil(e.length / Math.max(3, Math.floor(pw / 70))));
      e.forEach(function (r, i) {
        var cx = L + gw * (i + 0.5), vals = [[r.solar, COLORS.solar], [r.load, COLORS.load], [r.imp, COLORS.grid]];
        if (i === hover2) { c.fillStyle = "rgba(255,255,255,.07)"; c.fillRect(L + gw * i, T, gw, ph); }
        vals.forEach(function (vv, j) {
          var x = cx + (j - 1) * (bw + 1) - bw / 2, y = Y(vv[0]);
          c.fillStyle = vv[1]; c.fillRect(x, y, bw, T + ph - y);
        });
        if (i % every === 0) { c.fillStyle = "#8d97b3"; c.textAlign = "center"; c.textBaseline = "top"; c.fillText(tickLabel(r.t, step), cx, T + ph + 7); c.textBaseline = "middle"; }
      });
      bgeo = { L: L, gw: gw, n: e.length };
    }
    bars.addEventListener("mousemove", function (e) {
      if (!data || !bgeo) return;
      var r = bars.getBoundingClientRect(), i = Math.floor((e.clientX - r.left - bgeo.L) / bgeo.gw);
      if (i < 0 || i >= bgeo.n) { hover2 = -1; tip2.style.display = "none"; drawBars(); return; }
      if (i !== hover2) { hover2 = i; drawBars(); }
      var pt = data.energy[i];
      tip2.innerHTML = "<b>" + fullTime(pt.t, data.energy_bucket_s) + "</b>" +
        '<br><span style="color:' + COLORS.solar + '">&#9679;</span> Solar made: ' + fmtKwh(pt.solar) + " kWh" +
        '<br><span style="color:' + COLORS.load + '">&#9679;</span> Home used: ' + fmtKwh(pt.load) + " kWh" +
        '<br><span style="color:' + COLORS.grid + '">&#9679;</span> Grid imported: ' + fmtKwh(pt.imp) + " kWh" +
        '<br><span style="color:' + COLORS.exp + '">&#9679;</span> Grid exported: ' + fmtKwh(pt.exp) + " kWh";
      tip2.style.display = "block";
      var tx = e.clientX - r.left + 14; if (tx + tip2.offsetWidth > r.width - 4) tx = e.clientX - r.left - tip2.offsetWidth - 14;
      tip2.style.left = Math.max(4, tx) + "px"; tip2.style.top = "10px";
    });
    bars.addEventListener("mouseleave", function () { hover2 = -1; tip2.style.display = "none"; if (data) drawBars(); });

    // ------------------------------------------------ totals
    function drawTotals() {
      var t = data && data.totals, box = q("totals");
      if (!t) { box.innerHTML = ""; return; }
      function tile(label, val, unit) { return '<div class="total"><span>' + label + "</span><b>" + val + "</b>" + (unit ? "<small>" + unit + "</small>" : "") + "</div>"; }
      var pct = function (v) { return v === null || v === undefined ? "--" : v; };
      box.innerHTML =
        tile("Solar made", fmtKwh(t.solar), "kWh") + tile("Home used", fmtKwh(t.load), "kWh") +
        tile("Grid imported", fmtKwh(t.imp), "kWh") + tile("Grid exported", fmtKwh(t.exp), "kWh") +
        tile("Battery charged", fmtKwh(t.chg), "kWh") + tile("Battery discharged", fmtKwh(t.dis), "kWh") +
        tile("Self-sufficiency", pct(t.self_sufficiency_pct), t.self_sufficiency_pct === null ? "" : "%") +
        tile("Solar used at home", pct(t.solar_used_pct), t.solar_used_pct === null ? "" : "%") +
        tile("Peak solar", fmtW(t.peak_solar_w || 0), "") + tile("Peak home load", fmtW(t.peak_load_w || 0), "");
    }

    function drawAll() { drawLineFull(); drawBars(); drawTotals(); }
    var rt = null;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (data) drawAll(); }, 120); });
    var timer = setInterval(function () { if (!document.hidden) load(); }, 15000);

    load();
    return {
      refresh: load,
      setSource: function (f, csv) { fetchStats = f; csvUrl = csv; data = null; load(); },
      destroy: function () { clearInterval(timer); }
    };
  }

  global.LmarAnalytics = { mount: mount, demoStats: demoStats };
})(window);
