/* LmarSys, demo mode only. No network requests; every number is simulated in your browser. */
(function () {
  var root = document.getElementById('sm-app');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var TICK = 3000;                           // 3 s updates
  var soc = 55, daily = 6.4, timer = null;

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
  var svg = '<svg viewBox="0 0 600 360" role="img" aria-label="Live power flow between solar panels, inverter, battery, grid and home">';
  var paths = {
    sol: 'M300 82 L300 145', grid: 'M163 180 L240 180',
    bat: 'M300 278 L300 215', home: 'M360 180 L437 180'
  };
  var colors = { sol: 'var(--sm-solar)', grid: 'var(--sm-grid)', bat: 'var(--sm-batt)', home: 'var(--sm-home)' };
  Object.keys(paths).forEach(function (k) { svg += '<path id="sm-p-' + k + '" class="sm-line idle" d="' + paths[k] + '" style="stroke:' + colors[k] + '"/>'; });
  function node(k, label, x, y) {
    return '<rect class="node" x="' + (x - 75) + '" y="' + (y - 38) + '" width="150" height="76" rx="16"/>' +
      '<text class="lbl" x="' + x + '" y="' + (y - 9) + '">' + label + '</text><text class="val" id="sm-n-' + k + '" x="' + x + '" y="' + (y + 21) + '">0 W</text>';
  }
  // layout: grid on the left, solar on top, inverter in the middle, battery at the bottom, home on the right
  svg += node('sol', 'Solar panels', 300, 44) + node('grid', 'Grid (WAPDA)', 88, 180) +
    node('bat', 'Battery', 300, 316) + node('home', 'Home load', 512, 180) +
    '<rect class="node" x="240" y="145" width="120" height="70" rx="16"/><text class="lbl" x="300" y="173">Inverter</text><text class="val" id="sm-n-inv" x="300" y="200">0 W</text></svg>';
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
  }

  function tick() { render(step()); }
  function setBadge(state, text) { var b = $('sm-badge'); b.className = 'sm-badge ' + state; $('sm-badge-t').textContent = text; }

  function startDemo() {
    clearInterval(timer);
    setBadge('online', 'Online (demo)'); tick(); timer = setInterval(tick, TICK);
  }
  function stopDemo() {
    clearInterval(timer); setBadge('offline', 'Offline');
    ['sol', 'grid', 'bat', 'home'].forEach(function (k) { $('sm-p-' + k).setAttribute('class', 'sm-line idle'); });
  }
  $('sm-demo').addEventListener('change', function (e) { e.target.checked ? startDemo() : stopDemo(); });
  if (window.LmarAnalytics && $('sm-analytics')) {
    LmarAnalytics.mount($('sm-analytics'), { fetchStats: function (r) { return Promise.resolve(LmarAnalytics.demoStats(r)); }, csvUrl: null });
  }
  startDemo();
})();
