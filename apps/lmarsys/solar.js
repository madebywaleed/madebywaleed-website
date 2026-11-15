/* LmarSys, demo mode only. No network requests; every number is simulated in your browser. */
(function () {
  var root = document.getElementById('sm-app');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var TICK = 3000, KEEP = 600;               // 3 s updates, 30 min of history
  var hist = [], soc = 55, daily = 6.4, timer = null;

  function sim(minute) {                      // minute of day, 0..1440
    var sun = Math.max(0, Math.sin((minute - 360) / 720 * Math.PI));   // 06:00 to 18:00
    var cloud = 0.8 + 0.18 * Math.sin(minute * 1.3) * Math.cos(minute * 0.7) + 0.02 * Math.sin(minute * 6);
    var pv = Math.round(sun * 5200 * cloud);
    var load = Math.round(700 + 450 * Math.sin(minute / 90) + (minute > 1080 && minute < 1380 ? 900 : 0) + Math.random() * 50);
    var gap = load - pv;                       // positive: need energy
    var batt = 0;                              // + discharging, - charging
    if (gap > 0) batt = soc > 20 ? Math.min(gap, 2800) : 0;
    else batt = soc < 100 ? -Math.min(-gap, 2800) : 0;
    var grid = load - pv - batt;               // + import, - export
    return { pv: pv, load: load, batt: Math.round(batt), grid: Math.round(grid) };
  }
  function step(offsetMs, keep) {
    var d = new Date(Date.now() - (offsetMs || 0)), minute = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    var s = sim(minute), soc0 = soc, daily0 = daily;
    soc = Math.max(0, Math.min(100, soc - s.batt / 10000 * (TICK / 3600000) * 100 * 15)); // 10 kWh battery, sped up 15x so it visibly moves
    daily += s.pv / 1000 * (TICK / 3600000);
    var pv1 = Math.round(s.pv * 0.55);
    var out = {
      pv1: pv1, pv2: s.pv - pv1, pv: s.pv, load: s.load, batt: s.batt, grid: s.grid, soc: soc, daily: daily,
      battV: 48 + soc * 0.065, gridV: 228 + Math.random() * 4, hz: 49.95 + Math.random() * 0.1,
      temp: 38 + s.pv / 5200 * 14 + Math.random(), t: Date.now() - (offsetMs || 0)
    };
    if (keep) { soc = soc0; daily = daily0; }   // history points must not move the live battery or daily total
    return out;
  }

  // power-flow SVG
  var svg = '<svg viewBox="0 0 600 300" role="img" aria-label="Live power flow between solar panels, inverter, battery, grid and home">';
  var paths = {
    sol: 'M163 62 C225 62 225 118 246 130', grid: 'M437 62 C375 62 375 118 354 130',
    bat: 'M163 238 C225 238 225 182 246 170', home: 'M437 238 C375 238 375 182 354 170'
  };
  var colors = { sol: 'var(--sm-solar)', grid: 'var(--sm-grid)', bat: 'var(--sm-batt)', home: 'var(--sm-home)' };
  Object.keys(paths).forEach(function (k) { svg += '<path id="sm-p-' + k + '" class="sm-line idle" d="' + paths[k] + '" style="stroke:' + colors[k] + '"/>'; });
  function node(k, label, x, y) {
    return '<rect class="node" x="' + (x - 75) + '" y="' + (y - 38) + '" width="150" height="76" rx="16"/>' +
      '<text class="lbl" x="' + x + '" y="' + (y - 9) + '">' + label + '</text><text class="val" id="sm-n-' + k + '" x="' + x + '" y="' + (y + 21) + '">0 W</text>';
  }
  svg += node('sol', 'Solar panels', 88, 62) + node('grid', 'Grid (WAPDA)', 512, 62) +
    node('bat', 'Battery', 88, 238) + node('home', 'Home load', 512, 238) +
    '<rect class="node" x="240" y="115" width="120" height="70" rx="16"/><text class="lbl" x="300" y="143">Inverter</text><text class="val" id="sm-n-inv" x="300" y="170">0 W</text></svg>';
  $('sm-flow').innerHTML = svg;

  function setLine(k, watts, forward) {      // forward = flowing toward the inverter
    var el = $('sm-p-' + k), mag = Math.abs(watts);
    if (mag < 15) { el.setAttribute('class', 'sm-line idle'); return; }
    var dur = Math.max(0.6, 3.4 - mag / 1800);   // more power, faster flow
    el.style.setProperty('--dur', dur.toFixed(2) + 's');
    el.setAttribute('class', 'sm-line ' + (forward ? 'fwd' : 'rev'));
  }
  function fmtW(w) { return Math.abs(w) >= 1000 ? (w / 1000).toFixed(2) + ' kW' : Math.round(w) + ' W'; }

  function render(d) {
    $('sm-n-sol').textContent = fmtW(d.pv);
    $('sm-n-grid').textContent = fmtW(Math.abs(d.grid));
    $('sm-n-bat').textContent = fmtW(Math.abs(d.batt));
    $('sm-n-home').textContent = fmtW(d.load);
    $('sm-n-inv').textContent = fmtW(d.pv + Math.max(0, d.batt) + Math.max(0, d.grid));
    // every path is drawn from the device towards the inverter, so "forward" means energy flows into the inverter
    setLine('sol', d.pv, true);
    setLine('bat', d.batt, d.batt >= 0);   // discharging feeds the inverter, charging takes from it
    setLine('grid', d.grid, d.grid >= 0);  // importing feeds the inverter, exporting takes from it
    setLine('home', d.load, false);        // the home always draws from the inverter

    $('sm-soc').textContent = Math.round(d.soc) + '%';
    $('sm-soc-sub').textContent = (d.batt > 20 ? 'Discharging ' : d.batt < -20 ? 'Charging ' : 'Idle ') + (Math.abs(d.batt) > 20 ? fmtW(Math.abs(d.batt)) : '');
    $('sm-ring').setAttribute('stroke-dasharray', (d.soc / 100 * 163.4).toFixed(1) + ' 163.4');
    $('sm-daily').textContent = d.daily.toFixed(1) + ' kWh';
    $('sm-pv').textContent = fmtW(d.pv);
    $('sm-pv-sub').textContent = 'PV1 ' + fmtW(d.pv1) + ' / PV2 ' + fmtW(d.pv2);
    $('sm-gridst').textContent = d.grid > 20 ? 'Importing' : d.grid < -20 ? 'Exporting' : 'Balanced';
    $('sm-grid-sub').textContent = fmtW(Math.abs(d.grid)) + ' · ' + d.gridV.toFixed(0) + ' V · ' + d.hz.toFixed(2) + ' Hz';
    $('sm-temp').textContent = d.temp.toFixed(1) + ' °C';
    $('sm-temp-sub').textContent = 'Battery ' + d.battV.toFixed(1) + ' V';
    drawChart();
  }

  // rolling chart on a canvas (no external library)
  function drawChart() {
    var c = $('sm-canvas'), r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width) return;
    c.width = r.width * dpr; c.height = r.height * dpr;
    var g = c.getContext('2d'); g.scale(dpr, dpr);
    var W = r.width, H = r.height, L = 44, B = 22, T = 8, max = 1000;
    hist.forEach(function (p) { max = Math.max(max, p.pv, p.load); });
    max = Math.ceil(max / 1000) * 1000;
    g.font = '11px sans-serif'; g.fillStyle = '#9aa4c4'; g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1;
    var n = max / 1000;
    for (var i = 0; i <= n; i++) {
      var y = T + (H - T - B) * i / n;
      g.beginPath(); g.moveTo(L, y); g.lineTo(W, y); g.stroke();
      g.fillText((n - i) + ' kW', 2, y + 4);
    }
    g.fillText('-30 min', L, H - 6); g.fillText('now', W - 24, H - 6);
    function line(key, col) {
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
      hist.forEach(function (p, i) {
        var x = L + (W - L) * i / (KEEP - 1) + (W - L) * (KEEP - hist.length) / (KEEP - 1);
        var y = T + (H - T - B) * (1 - p[key] / max);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.stroke();
    }
    line('pv', '#ffc233'); line('load', '#5aa9ff');
  }

  function tick() { var d = step(); hist.push(d); if (hist.length > KEEP) hist.shift(); render(d); }
  function setBadge(state, text) { var b = $('sm-badge'); b.className = 'sm-badge ' + state; $('sm-badge-t').textContent = text; }

  function startDemo() {
    clearInterval(timer);
    hist = []; for (var i = KEEP - 1; i >= 1; i--) hist.push(step(i * TICK, true));
    setBadge('online', 'Online (demo)'); tick(); timer = setInterval(tick, TICK);
  }
  function stopDemo() {
    clearInterval(timer); setBadge('offline', 'Offline');
    ['sol', 'grid', 'bat', 'home'].forEach(function (k) { $('sm-p-' + k).setAttribute('class', 'sm-line idle'); });
  }
  $('sm-demo').addEventListener('change', function (e) { e.target.checked ? startDemo() : stopDemo(); });
  window.addEventListener('resize', drawChart);
  startDemo();
})();
