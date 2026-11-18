// Shared engine for the Universal Converter hub and its single-conversion pages.
// A page can preset the converter with data-category, data-from, data-to and data-amount on <form id="converter">.
(function () {
  // Each unit is expressed as a factor to the base unit of its group.
  var GROUPS = {
    'Length': { base: 'm', units: {
      'Millimetre (mm)': 0.001, 'Centimetre (cm)': 0.01, 'Metre (m)': 1, 'Kilometre (km)': 1000,
      'Inch (in)': 0.0254, 'Foot (ft)': 0.3048, 'Yard (yd)': 0.9144, 'Mile (mi)': 1609.344, 'Nautical mile': 1852 } },
    'Weight and mass': { base: 'kg', units: {
      'Milligram (mg)': 0.000001, 'Gram (g)': 0.001, 'Kilogram (kg)': 1, 'Tonne (t)': 1000,
      'Ounce (oz)': 0.028349523125, 'Pound (lb)': 0.45359237, 'Stone (st)': 6.35029318,
      'Tola (Pakistan)': 0.0116638, 'Seer (South Asia)': 0.9331, 'Maund (South Asia)': 37.3242 } },
    'Volume and liquids': { base: 'l', units: {
      'Millilitre (ml)': 0.001, 'Litre (l)': 1, 'Cubic metre (m³)': 1000,
      'US gallon': 3.785411784, 'US quart': 0.946352946, 'US pint': 0.473176473, 'US cup': 0.2365882365,
      'US fluid ounce': 0.0295735296, 'US tablespoon': 0.01478676478, 'US teaspoon': 0.00492892159,
      'UK gallon': 4.54609, 'UK pint': 0.56826125, 'UK fluid ounce': 0.0284130625 } },
    'Area and land': { base: 'm2', units: {
      'Square millimetre': 0.000001, 'Square centimetre': 0.0001, 'Square metre (m²)': 1, 'Square kilometre': 1000000,
      'Hectare': 10000, 'Acre': 4046.8564224, 'Square foot': 0.09290304, 'Square yard': 0.83612736,
      'Square mile': 2589988.110336, 'Marla (Pakistan)': 25.29295, 'Kanal (Pakistan)': 505.857 } },
    'Speed': { base: 'ms', units: {
      'Metre per second': 1, 'Kilometre per hour': 0.2777777778, 'Mile per hour': 0.44704,
      'Foot per second': 0.3048, 'Knot': 0.5144444444 } },
    'Time': { base: 's', units: {
      'Millisecond': 0.001, 'Second': 1, 'Minute': 60, 'Hour': 3600, 'Day': 86400, 'Week': 604800,
      'Month (average)': 2629746, 'Year (average)': 31556952 } },
    'Digital storage': { base: 'B', units: {
      'Bit': 0.125, 'Byte (B)': 1, 'Kilobyte (KB)': 1000, 'Megabyte (MB)': 1000000,
      'Gigabyte (GB)': 1000000000, 'Terabyte (TB)': 1000000000000,
      'Kibibyte (KiB)': 1024, 'Mebibyte (MiB)': 1048576, 'Gibibyte (GiB)': 1073741824 } },
    'Pressure': { base: 'Pa', units: {
      'Pascal (Pa)': 1, 'Kilopascal (kPa)': 1000, 'Bar': 100000, 'Atmosphere (atm)': 101325,
      'PSI': 6894.757293168, 'mmHg': 133.322387415 } },
    'Energy': { base: 'J', units: {
      'Joule (J)': 1, 'Kilojoule (kJ)': 1000, 'Calorie (cal)': 4.184, 'Kilocalorie (kcal)': 4184,
      'Watt-hour (Wh)': 3600, 'Kilowatt-hour (kWh)': 3600000, 'BTU': 1055.05585, 'Foot-pound': 1.3558179483 } },
    'Power': { base: 'W', units: {
      'Watt (W)': 1, 'Kilowatt (kW)': 1000, 'Horsepower (metric)': 735.49875,
      'Horsepower (mechanical)': 745.69987, 'BTU per hour': 0.29307107 } },
    'Fuel economy': { base: 'kmpl', inverse: ['L/100 km'], units: {
      'km per litre': 1, 'Miles per gallon (US)': 0.4251437075, 'Miles per gallon (UK)': 0.3540061, 'L/100 km': 'inverse' } },
    'Cooking (volume to weight)': { base: 'ml', units: {
      'Metric cup (250 ml)': 250, 'US cup (236.6 ml)': 236.5882365, 'Tablespoon (15 ml)': 15, 'Teaspoon (5 ml)': 5,
      'Millilitre (ml)': 1, 'Litre (l)': 1000, 'Gram (g) of chosen ingredient': 1 },
      density: { 'Water or milk': 1.0, 'Flour (all-purpose)': 0.528, 'Sugar (granulated)': 0.845,
        'Brown sugar (packed)': 0.900, 'Butter': 0.960, 'Rice (uncooked)': 0.782, 'Rolled oats': 0.381, 'Honey': 1.437 } },
    'Currency (you enter the rate)': { base: 'x', units: { 'Your currency (from)': 1, 'Your currency (to)': 1 }, currency: true }
  };
  var TEMP = ['Celsius (°C)', 'Fahrenheit (°F)', 'Kelvin (K)'];

  var cat = document.getElementById('category'), from = document.getElementById('from'), to = document.getElementById('to');
  var amount = document.getElementById('amount'), answer = document.getElementById('answer'), formula = document.getElementById('formula');
  var result = document.getElementById('result'), quick = document.getElementById('quick'), extra = document.getElementById('extra');
  var fromChips = document.getElementById('fromChips'), toChips = document.getElementById('toChips');

  // Builds a row of option buttons. The chosen value is written to a hidden input.
  function chips(container, input, names, onPick) {
    container.innerHTML = '';
    names.forEach(function (n) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = n; b.setAttribute('data-value', n);
      b.setAttribute('aria-pressed', String(input.value === n));
      b.addEventListener('click', function () {
        input.value = n; markChips(container, n); onPick();
      });
      container.appendChild(b);
    });
  }
  function markChips(container, value) {
    Array.prototype.forEach.call(container.querySelectorAll('.chip'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-value') === value));
    });
  }
  function syncChips() { markChips(fromChips, from.value); markChips(toChips, to.value); }

  var TYPES = Object.keys(GROUPS).concat(['Temperature']);
  var tabsEl = document.getElementById('tabs');
  var tabButtons = TYPES.map(function (k, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab');
    b.id = 'tab-' + i; b.textContent = k; b.setAttribute('data-type', k);
    b.setAttribute('aria-selected', 'false'); b.setAttribute('tabindex', '-1');
    tabsEl.appendChild(b);
    return b;
  });
  function selectType(k) {
    cat.value = k;
    tabButtons.forEach(function (b) {
      var on = b.getAttribute('data-type') === k;
      b.setAttribute('aria-selected', String(on));
      b.setAttribute('tabindex', on ? '0' : '-1');
    });
  }
  tabButtons.forEach(function (b, i) {
    b.addEventListener('click', function () { selectType(b.getAttribute('data-type')); cat.dispatchEvent(new Event('change')); });
    b.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabButtons.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabButtons.length) % tabButtons.length;
      if (e.key === 'Home') n = 0;
      if (e.key === 'End') n = tabButtons.length - 1;
      if (n !== null) { e.preventDefault(); tabButtons[n].focus(); tabButtons[n].click(); }
    });
  });

  function unitsFor(c) {
    if (c === 'Temperature') return TEMP;
    return Object.keys(GROUPS[c].units);
  }

  function reset(c) {
    var units = unitsFor(c);
    from.value = units[0];
    to.value = units[Math.min(1, units.length - 1)];
    chips(fromChips, from, units, update);
    chips(toChips, to, units, update);
    extra.hidden = true; extra.innerHTML = '';
    if (c === 'Cooking (volume to weight)') {
      extra.hidden = false;
      var label = document.createElement('span');
      label.className = 'flabel'; label.textContent = 'Ingredient (for grams)';
      var holder = document.createElement('div'); holder.className = 'chips'; holder.id = 'ingredientChips';
      var hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.id = 'ingredient';
      var names = Object.keys(GROUPS[c].density);
      hidden.value = names[0];
      extra.appendChild(label); extra.appendChild(holder); extra.appendChild(hidden);
      chips(holder, hidden, names, update);
    }
    if (c === 'Currency (you enter the rate)') {
      extra.hidden = false;
      extra.innerHTML = '<label for="rate">Exchange rate: 1 unit of “from” equals how many of “to”?</label><input type="number" id="rate" inputmode="decimal" step="any" min="0" placeholder="For example 278 for USD to PKR"><p class="hint">Enter today’s rate from your bank or a trusted source. We do not store it.</p>';
      document.getElementById('rate').addEventListener('input', update);
    }
  }

  function fmt(n) {
    if (!isFinite(n)) return '—';
    if (n === 0) return '0';
    var a = Math.abs(n);
    if (a >= 1e12 || a < 1e-6) return n.toExponential(4);
    var r = Number(n.toPrecision(8));
    return r.toLocaleString('en-US', { maximumFractionDigits: 10 });
  }

  function factorOf(c, unit) { return GROUPS[c].units[unit]; }

  function convertValue(c, v, f, t) {
    if (c === 'Temperature') {
      var k = f.indexOf('Celsius') === 0 ? v + 273.15 : f.indexOf('Fahrenheit') === 0 ? (v - 32) * 5 / 9 + 273.15 : v;
      return t.indexOf('Celsius') === 0 ? k - 273.15 : t.indexOf('Fahrenheit') === 0 ? (k - 273.15) * 9 / 5 + 32 : k;
    }
    if (c === 'Fuel economy') {
      if (f === 'L/100 km') { var kml = v === 0 ? Infinity : 100 / v; return t === 'L/100 km' ? v : kml / factorOf(c, t); }
      var base = v * factorOf(c, f);
      return t === 'L/100 km' ? (base === 0 ? Infinity : 100 / base) : base / factorOf(c, t);
    }
    if (c === 'Cooking (volume to weight)') {
      var ing = document.getElementById('ingredient');
      var dens = ing ? GROUPS[c].density[ing.value] : 1;
      var isGf = f.indexOf('Gram') === 0, isGt = t.indexOf('Gram') === 0;
      var ml = isGf ? v / dens : v * factorOf(c, f);
      return isGt ? ml * dens : ml / factorOf(c, t);
    }
    if (c === 'Currency (you enter the rate)') {
      var rate = Number(document.getElementById('rate') && document.getElementById('rate').value);
      if (!rate || rate <= 0) return NaN;
      var first = 'Your currency (from)';
      var amountFirst = f === first ? v : v / rate;
      return t === first ? amountFirst : amountFirst * rate;
    }
    return v * factorOf(c, f) / factorOf(c, t);
  }

  function quickRows(c, f, t) {
    var samples = [1, 5, 10, 25, 50, 100, 500, 1000];
    return samples.map(function (s) {
      var r = convertValue(c, s, f, t);
      return '<tr><td>' + fmt(s) + ' ' + f + '</td><td>' + fmt(r) + ' ' + t + '</td></tr>';
    }).join('');
  }

  function show(text, extraLine, isErr) {
    answer.textContent = text;
    formula.textContent = extraLine || '';
    result.classList.toggle('error', !!isErr);
  }

  function update() {
    syncChips();
    var c = cat.value, f = from.value, t = to.value;
    var v = parseFloat(amount.value);
    if (c === 'Currency (you enter the rate)') {
      var rateEl = document.getElementById('rate');
      if (!rateEl || !rateEl.value) { show('Enter the exchange rate above.', '', true); quick.innerHTML = ''; return; }
      if (isNaN(v)) { show('Enter an amount to convert.', '', true); quick.innerHTML = ''; return; }
      var rr = convertValue(c, v, f, t);
      show(fmt(v) + ' ' + f + ' = ' + fmt(rr) + ' ' + t, '1 ' + f + ' = ' + rateEl.value + ' ' + t + ' (your rate).', false);
      quick.innerHTML = quickRows(c, f, t);
      return;
    }
    if (isNaN(v)) { show('Enter an amount to convert.', '', true); quick.innerHTML = ''; return; }
    var r = convertValue(c, v, f, t);
    if (!isFinite(r)) { show('That value cannot be converted.', 'Check the amount, for example a fuel figure of zero has no L/100 km value.', true); quick.innerHTML = ''; return; }
    var extraLine = '';
    if (c === 'Temperature') extraLine = 'Temperature uses the correct formula for each scale, not a simple multiplier.';
    if (c === 'Fuel economy' && (f === 'L/100 km' || t === 'L/100 km')) extraLine = 'Litres per 100 km works in reverse: a lower number means better economy.';
    if (c === 'Cooking (volume to weight)') {
      var ing = document.getElementById('ingredient').value;
      var usesGrams = f.indexOf('Gram') === 0 || t.indexOf('Gram') === 0;
      extraLine = usesGrams ? 'Grams use a typical density for ' + ing.toLowerCase() + '. Actual weight varies with packing.' : 'Volume conversion between cooking measures.';
    }
    show(fmt(v) + ' ' + f + ' = ' + fmt(r) + ' ' + t, extraLine, false);
    quick.innerHTML = quickRows(c, f, t);
  }

  cat.addEventListener('change', function () { selectType(cat.value); reset(cat.value); update(); });
  amount.addEventListener('input', update);
  document.getElementById('swap').addEventListener('click', function () {
    var a = from.value; from.value = to.value; to.value = a; update();
  });
  document.getElementById('converter').addEventListener('submit', function (e) { e.preventDefault(); update(); });

  var form = document.getElementById('converter');
  var startType = form.getAttribute('data-category') || 'Length';
  if (!GROUPS[startType] && startType !== 'Temperature') startType = 'Length';
  selectType(startType); reset(startType);
  var pf = form.getAttribute('data-from'), pt = form.getAttribute('data-to'), pa = form.getAttribute('data-amount');
  var avail = unitsFor(startType);
  if (pf && avail.indexOf(pf) > -1) from.value = pf;
  if (pt && avail.indexOf(pt) > -1) to.value = pt;
  if (pa) amount.value = pa;
  update();

  document.querySelectorAll('ins.adsbygoogle').forEach(function () {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ad blocked or unavailable */ }
  });
})();
