#!/usr/bin/env python3
"""Generates the single-conversion pages under tools/converters/universal-converter/<slug>/.
Run from the repo root: python3 build/gen_conversions.py"""
import re, json, os
D = 'tools/converters/universal-converter/'
H = open(D + 'index.html', encoding='utf-8').read()
top0 = H[:H.index('</main>') + 7]
ad = ''

F = {  # factor to base unit
 'Tola (Pakistan)': 0.0116638, 'Seer (South Asia)': 0.9331, 'Maund (South Asia)': 37.3242,
 'Gram (g)': 0.001, 'Kilogram (kg)': 1, 'Pound (lb)': 0.45359237,
 'Marla (Pakistan)': 25.2928526, 'Kanal (Pakistan)': 505.857052, 'Square foot': 0.09290304,
 'Mile (mi)': 1609.344, 'Kilometre (km)': 1000, 'Inch (in)': 0.0254, 'Centimetre (cm)': 0.01,
}
def conv(p, v):
    if p['cat'] == 'Temperature':
        if p['from'].startswith('Celsius'): return v * 9 / 5 + 32
        return (v - 32) * 5 / 9
    return v * F[p['from']] / F[p['to']]
def num(x):
    s = ('%.4f' % x).rstrip('0').rstrip('.')
    if s in ('-0', ''): s = '0'
    ip, _, fp = s.partition('.')
    neg = ip.startswith('-'); ip = ip.lstrip('-')
    ip = '{:,}'.format(int(ip))
    return ('-' if neg else '') + ip + ('.' + fp if fp else '')

P = [
 dict(slug='tola-to-grams', title='Tola to Grams', cat='Weight and mass', **{'from':'Tola (Pakistan)'}, to='Gram (g)', fs='tola', ts='g', group='weight',
  rule='1 tola = 11.6638 grams', desc='1 tola = 11.66 grams',
  about='A tola is a traditional unit of weight used in Pakistan, India and Bangladesh, mostly for gold and silver. One tola is 11.6638 grams, usually rounded to 11.66 grams.',
  how='multiply the number of tola by 11.6638', back='divide the grams by 11.6638', ex=(5,),
  samples=[0.5,1,2,5,10,20,50,100], rsamples=[1,5,10,50,100,250,500,1000],
  faqs=[("How many grams are in 1 tola?","1 tola is 11.6638 grams, usually rounded to 11.66 grams. Gold and silver are commonly sold by the tola in Pakistan and India."),
  ("How many tola are in 1 kilogram?","1 kilogram is 1,000 grams, which is about 85.73 tola."),
  ("Is a tola the same in every country?","This page uses the Pakistani tola of 11.6638 grams, which is also the standard in India. Some older or regional tolas differ slightly, so check with your jeweller if the exact weight matters.")]),
 dict(slug='seer-to-kg', title='Seer to Kg', cat='Weight and mass', **{'from':'Seer (South Asia)'}, to='Kilogram (kg)', fs='seer', ts='kg', group='weight',
  rule='1 seer = 0.9331 kilograms', desc='1 seer is about 0.93 kg (933 grams)',
  about='The seer is a traditional unit of weight used in Pakistan and parts of South Asia for grain, sugar, flour and other goods. One seer is about 0.9331 kilograms, or roughly 933 grams. There are 40 seers in a maund.',
  how='multiply the number of seers by 0.9331', back='divide the kilograms by 0.9331', ex=(5,),
  samples=[0.5,1,2,5,10,20,40,100], rsamples=[1,2,5,10,25,50,100],
  faqs=[("How many kg is 1 seer?","1 seer is about 0.9331 kilograms, or roughly 933 grams."),("How many seers are in 1 kg?","1 kilogram is about 1.0717 seers."),("How many seers make a maund?","There are 40 seers in 1 maund, which is about 37.32 kilograms."),("Is the seer the same everywhere?","This page uses the standard South Asian seer of about 933 grams. Some regions and trades used slightly different seers in the past, so check the local definition if exact weight matters.")]),
 dict(slug='maund-to-kg', title='Maund to Kg', cat='Weight and mass', **{'from':'Maund (South Asia)'}, to='Kilogram (kg)', fs='maund', ts='kg', group='weight',
  rule='1 maund = 37.3242 kilograms', desc='1 maund is about 37.32 kg',
  about='The maund (also called man) is a traditional unit of weight used in Pakistan and India, mostly for crops such as wheat, rice and cotton. One maund is 40 seers, which is about 37.3242 kilograms.',
  how='multiply the number of maunds by 37.3242', back='divide the kilograms by 37.3242', ex=(5,),
  samples=[0.5,1,2,5,10,20,50,100], rsamples=[10,25,50,100,250,500,1000],
  faqs=[("How many kg is 1 maund?","1 maund is about 37.3242 kilograms."),("How many seers are in a maund?","1 maund is 40 seers."),("How many maunds are in a tonne?","1 tonne is 1,000 kilograms, which is about 26.79 maunds."),("Is the maund the same everywhere?","This page uses the standard South Asian maund of 40 seers (about 37.32 kg). Older local maunds varied, so confirm the definition when trading by weight.")]),
 dict(slug='kg-to-pounds', title='Kg to Pounds', cat='Weight and mass', **{'from':'Kilogram (kg)'}, to='Pound (lb)', fs='kg', ts='lb', group='weight',
  rule='1 kilogram = 2.2046 pounds', desc='1 kg is about 2.2046 pounds',
  about='The kilogram is the metric unit of weight and the pound is used in the US, the UK and some other countries. One kilogram is about 2.2046 pounds.',
  how='multiply the kilograms by 2.2046', back='divide the pounds by 2.2046', ex=(70,),
  samples=[0.5,1,2,5,10,20,50,100], rsamples=[1,5,10,50,100,150,200],
  faqs=[("How many pounds are in 1 kg?","1 kilogram is about 2.2046 pounds."),("How do I convert kg to lb quickly?","Double the kilograms and add 10 percent. For example 50 kg is roughly 100 + 10 = 110 lb (the exact answer is 110.23 lb)."),("How many kg is 1 pound?","1 pound is exactly 0.45359237 kilograms.")]),
 dict(slug='pounds-to-kg', title='Pounds to Kg', cat='Weight and mass', **{'from':'Pound (lb)'}, to='Kilogram (kg)', fs='lb', ts='kg', group='weight',
  rule='1 pound = 0.4536 kilograms', desc='1 pound is exactly 0.45359237 kg',
  about='The pound is used in the US, the UK and some other countries, while most of the world uses kilograms. One pound is exactly 0.45359237 kilograms, or about 0.4536 kg.',
  how='multiply the pounds by 0.4536', back='divide the kilograms by 0.4536', ex=(150,),
  samples=[1,5,10,25,50,100,150,200], rsamples=[1,5,10,50,70,100],
  faqs=[("How many kg is 1 pound?","1 pound is exactly 0.45359237 kilograms."),("How many pounds is 1 kg?","1 kilogram is about 2.2046 pounds."),("How do I convert lb to kg quickly?","Halve the pounds and subtract about 10 percent. For example 100 lb is roughly 50 - 5 = 45 kg (the exact answer is 45.36 kg).")]),
 dict(slug='marla-to-square-feet', title='Marla to Square Feet', cat='Area and land', **{'from':'Marla (Pakistan)'}, to='Square foot', fs='marla', ts='sq ft', group='land',
  rule='1 marla = 272.25 square feet', desc='1 marla is 272.25 square feet',
  about='The marla is a unit of land area used in Pakistan and parts of India. In Pakistan one marla is 272.25 square feet (about 25.29 square metres), and 20 marla make 1 kanal. Sizes can vary by region, so check the local definition before you buy or sell land.',
  how='multiply the number of marla by 272.25', back='divide the square feet by 272.25', ex=(5,),
  samples=[1,2,3,5,7,10,20,40], rsamples=[272.25,500,1000,1361.25,2722.5,5445],
  faqs=[("How many square feet are in 1 marla?","In Pakistan 1 marla is 272.25 square feet."),("How many marla make 1 kanal?","20 marla make 1 kanal, which is 5,445 square feet."),("Is a marla the same everywhere?","No. The marla differs between regions and between Pakistan and India, and some housing schemes use their own size. Always confirm the definition in your property documents.")]),
 dict(slug='kanal-to-marla', title='Kanal to Marla', cat='Area and land', **{'from':'Kanal (Pakistan)'}, to='Marla (Pakistan)', fs='kanal', ts='marla', group='land',
  rule='1 kanal = 20 marla', desc='1 kanal is 20 marla',
  about='The kanal and the marla are units of land area used in Pakistan and parts of India. In Pakistan 1 kanal is 20 marla, or 5,445 square feet. Sizes can vary by region, so check the local definition before you buy or sell land.',
  how='multiply the number of kanal by 20', back='divide the marla by 20', ex=(2.5,),
  samples=[0.25,0.5,1,2,5,10,20,50], rsamples=[1,5,10,20,40,100],
  faqs=[("How many marla are in 1 kanal?","1 kanal is 20 marla."),("How many square feet are in 1 kanal?","1 kanal is 5,445 square feet."),("Is a kanal the same everywhere?","No. Sizes vary by region, and some areas use a different marla. Confirm the definition in your property papers.")]),
 dict(slug='kanal-to-square-feet', title='Kanal to Square Feet', cat='Area and land', **{'from':'Kanal (Pakistan)'}, to='Square foot', fs='kanal', ts='sq ft', group='land',
  rule='1 kanal = 5,445 square feet', desc='1 kanal is 5,445 square feet',
  about='The kanal is a unit of land area used in Pakistan and parts of India. In Pakistan 1 kanal is 5,445 square feet (about 505.86 square metres), which is 20 marla. Sizes can vary by region, so check the local definition before you buy or sell land.',
  how='multiply the number of kanal by 5,445', back='divide the square feet by 5,445', ex=(2,),
  samples=[0.25,0.5,1,2,4,8,10,20], rsamples=[1000,2722.5,5445,10890,21780,43560],
  faqs=[("How many square feet are in 1 kanal?","1 kanal is 5,445 square feet."),("How many acres is 1 kanal?","1 acre is 43,560 square feet, so 1 kanal is about 0.125 acres (one eighth of an acre)."),("Is a kanal the same everywhere?","No. Sizes vary by region, so confirm the definition in your property documents.")]),
 dict(slug='celsius-to-fahrenheit', title='Celsius to Fahrenheit', cat='Temperature', **{'from':'Celsius (°C)'}, to='Fahrenheit (°F)', fs='°C', ts='°F', group='temp',
  rule='°F = °C × 9/5 + 32', desc='0 °C is 32 °F and 100 °C is 212 °F',
  about='Celsius is used in most of the world and Fahrenheit is used mainly in the United States. Water freezes at 0 °C (32 °F) and boils at 100 °C (212 °F).',
  how='multiply the degrees Celsius by 9/5 (1.8) and add 32', back='subtract 32 from the Fahrenheit value and multiply by 5/9', ex=(25,),
  samples=[-40,-10,0,10,20,25,37,100], rsamples=[0,32,50,68,77,98.6,212], unit_pos='deg',
  faqs=[("How do I convert Celsius to Fahrenheit?","Multiply by 1.8 and add 32. For example 25 °C × 1.8 + 32 = 77 °F."),("What is 37 °C in Fahrenheit?","37 °C is 98.6 °F, normal human body temperature."),("What is 180 °C in Fahrenheit?","180 °C is 356 °F, a common oven temperature for baking.")]),
 dict(slug='fahrenheit-to-celsius', title='Fahrenheit to Celsius', cat='Temperature', **{'from':'Fahrenheit (°F)'}, to='Celsius (°C)', fs='°F', ts='°C', group='temp',
  rule='°C = (°F − 32) × 5/9', desc='32 °F is 0 °C and 212 °F is 100 °C',
  about='Fahrenheit is used mainly in the United States and Celsius is used in most of the world. Water freezes at 32 °F (0 °C) and boils at 212 °F (100 °C).',
  how='subtract 32 from the Fahrenheit value and multiply by 5/9', back='multiply the degrees Celsius by 9/5 (1.8) and add 32', ex=(98.6,),
  samples=[-40,0,32,50,68,77,98.6,212], rsamples=[-10,0,10,20,25,37,100], unit_pos='deg',
  faqs=[("How do I convert Fahrenheit to Celsius?","Subtract 32, then multiply by 5/9. For example (77 − 32) × 5/9 = 25 °C."),("What is 98.6 °F in Celsius?","98.6 °F is 37 °C, normal human body temperature."),("At what temperature are Celsius and Fahrenheit equal?","At −40, where −40 °C is the same as −40 °F.")]),
 dict(slug='miles-to-km', title='Miles to Kilometres', cat='Length', **{'from':'Mile (mi)'}, to='Kilometre (km)', fs='mi', ts='km', group='length',
  rule='1 mile = 1.609344 kilometres', desc='1 mile is 1.609344 km',
  about='The mile is used for road distances in the US and the UK, while most countries use kilometres. One mile is exactly 1.609344 kilometres.',
  how='multiply the miles by 1.609344', back='divide the kilometres by 1.609344', ex=(26.2,),
  samples=[1,2,5,10,26.2,50,100,500], rsamples=[1,5,10,42.195,100,500],
  faqs=[("How many km is 1 mile?","1 mile is exactly 1.609344 kilometres."),("How many miles is a marathon in km?","A marathon is 42.195 km, which is about 26.2 miles."),("How many miles is 1 km?","1 kilometre is about 0.6214 miles.")]),
 dict(slug='inches-to-cm', title='Inches to Centimetres', cat='Length', **{'from':'Inch (in)'}, to='Centimetre (cm)', fs='in', ts='cm', group='length',
  rule='1 inch = 2.54 centimetres', desc='1 inch is exactly 2.54 cm',
  about='The inch is used for everyday lengths in the US and the UK, such as screen sizes and heights. One inch is exactly 2.54 centimetres.',
  how='multiply the inches by 2.54', back='divide the centimetres by 2.54', ex=(12,),
  samples=[1,2,5,6,10,12,24,36], rsamples=[1,5,10,30,50,100,150,180],
  faqs=[("How many cm is 1 inch?","1 inch is exactly 2.54 centimetres."),("How many cm is 1 foot?","1 foot is 12 inches, which is 30.48 centimetres."),("How many inches is 1 cm?","1 centimetre is about 0.3937 inches.")]),
]
PAGES = {p['slug']: p for p in P}
GROUPS = {'weight':'Weight', 'land':'Land area', 'temp':'Temperature', 'length':'Length'}

def row(p, a, b, ua, ub):
    return '<tr><td>%s %s</td><td>%s %s</td></tr>' % (num(a), ua, num(b), ub)

def build(p):
    slug = p['slug']; URL = 'https://madebywaleed.com/' + D + slug + '/'
    title = p['title'] + ' Converter'
    desc = 'Convert %s to %s instantly. %s. Free, no sign-up, works in your browser.' % (p['title'].split(' to ')[0].lower(), p['title'].split(' to ')[1].lower(), p['desc'])
    t = top0
    t = t.replace('<title>Universal Converter | MadeByWaleed</title>', '<title>%s | MadeByWaleed</title>' % title)
    t = re.sub(r'<meta name="description" content="[^"]*">', lambda m: '<meta name="description" content="%s">' % desc, t, 1)
    t = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="%s">' % title, t, 1)
    t = re.sub(r'<meta property="og:description" content="[^"]*">', lambda m: '<meta property="og:description" content="%s">' % desc, t, 1)
    t = t.replace('<meta property="og:url" content="https://madebywaleed.com/tools/converters/universal-converter/">', '<meta property="og:url" content="%s">' % URL)
    t = t.replace('<link rel="canonical" href="https://madebywaleed.com/tools/converters/universal-converter/">', '<link rel="canonical" href="%s">' % URL)
    ld = {"@context":"https://schema.org","@graph":[
      {"@type":"WebPage","name":title,"url":URL,"description":desc,"isPartOf":{"@type":"WebSite","name":"MadeByWaleed","url":"https://madebywaleed.com/"}},
      {"@type":"BreadcrumbList","itemListElement":[
        {"@type":"ListItem","position":1,"name":"Converters","item":"https://madebywaleed.com/tools/converters/"},
        {"@type":"ListItem","position":2,"name":"Universal Converter","item":"https://madebywaleed.com/tools/converters/universal-converter/"},
        {"@type":"ListItem","position":3,"name":p['title'],"item":URL}]},
      {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in p['faqs']]}]}
    t = t.replace('</head>', '  <script type="application/ld+json">%s</script>\n</head>' % json.dumps(ld, ensure_ascii=False), 1)
    t = t.replace('<form id="converter" novalidate>', '<form id="converter" novalidate data-category="%s" data-from="%s" data-to="%s" data-amount="1">' % (p['cat'], p['from'], p['to']))
    t = re.sub(r'<h1 id="tool-title">.*?</h1>', lambda m: '<h1 id="tool-title">%s<span class="dot">.</span></h1>' % title, t, 1, flags=re.S)
    intro = 'Convert %s. %s. Type an amount and the answer updates as you type. Use the swap button to go the other way, or pick any other unit.' % (p['title'].lower().replace(' to ', ' to ', 1), p['rule'])
    t = re.sub(r'<p class="intro">.*?</p>', lambda m: '<p class="intro">%s</p>' % intro, t, 1, flags=re.S)
    hint = 'Negative numbers work for temperature.' if p['cat'] == 'Temperature' else 'Type any amount. Decimals work too.'
    t = t.replace('<p class="hint" id="amount-hint">Negative numbers work for temperature.</p>', '<p class="hint" id="amount-hint">%s</p>' % hint)
    assert 'data-category' in t and title in t
    sp = (lambda s: s) 
    ua, ub = p['fs'], p['ts']
    a, b = p['title'].split(' to ')
    rows1 = ''.join(row(p, v, conv(p, v), ua, ub) for v in p['samples'])
    q = dict(p); q['from'], q['to'] = p['to'], p['from']
    if p['cat'] == 'Temperature':
        rows2 = ''.join(row(p, v, conv(q, v), ub, ua) for v in p['rsamples'])
    else:
        rows2 = ''.join(row(p, v, conv(q, v), ub, ua) for v in p['rsamples'])
    ex = p['ex'][0]
    exs = '%s %s = %s %s' % (num(ex), ua, num(conv(p, ex)), ub)
    faqhtml = ''.join('<details class="faq"><summary>%s</summary><p>%s</p></details>\n' % (qq, aa) for qq, aa in p['faqs'])
    sibs = [x for x in P if x['group'] == p['group'] and x['slug'] != slug]
    links = ''.join('<a class="tab" href="/%s%s/">%s</a>\n          ' % (D, x['slug'], x['title']) for x in sibs)
    body = f'''
{ad}
    <section class="content" aria-labelledby="guide-title">
      <div class="glass content-card">
        <h2 id="guide-title">How to convert {a.lower()} to {b.lower()}</h2>
        <p>{p['about']}</p>
        <p>To convert {a.lower()} to {b.lower()}, {p['how']}. To go the other way, {p['back']}.</p>
        <p>Example: {exs}.</p>
      </div>

      <div class="glass content-card">
        <h2>{p['title']} chart</h2>
        <table class="quick-table"><tbody>{rows1}</tbody></table>
      </div>

      <div class="glass content-card">
        <h2>{b} to {a} chart</h2>
        <table class="quick-table"><tbody>{rows2}</tbody></table>
      </div>

      <div class="glass content-card">
        <h2>Common questions</h2>
        {faqhtml}
      </div>

      <div class="glass content-card">
        <h2>More conversions</h2>
        <div class="tabs toolLinks">
          {links}<a class="tab" href="/{D}">All unit conversions</a>
          <a class="tab" href="/tools/converters/">All converters</a>
        </div>
      </div>
    </section>

    <footer class="site glass">
      <nav aria-label="Footer">
        <a href="/privacy-policy/">Privacy Policy</a>
        <a href="/about/">About Us</a>
        <a href="/support/">Support</a>
        <a href="mailto:support@madebywaleed.com">Contact</a>
      </nav>
      <p>&copy; 2026 MadeByWaleed, a brand of MBW Technologies (SMC-Private) Limited (CUIN 0366589). Free tool by MadeByWaleed.</p>
    </footer>
  </div>
  <script src="/tools/converters/universal-converter/converter.js"></script>
<script src="/script.js"></script>
</body>
</html>
'''
    os.makedirs(D + slug, exist_ok=True)
    open(D + slug + '/index.html', 'w', encoding='utf-8').write(t + '\n' + body)

for p in P: build(p)

# hub grid
h = open(D + 'index.html', encoding='utf-8').read()
grid = ''
for g, name in GROUPS.items():
    grid += '        <h3>%s</h3>\n        <div class="tabs toolLinks">\n' % name + ''.join('          <a class="tab" href="/%s%s/">%s</a>\n' % (D, x['slug'], x['title']) for x in P if x['group'] == g) + '        </div>\n'
new = '''    <section class="content" aria-labelledby="pages-title">
      <div class="glass content-card">
        <h2 id="pages-title">Popular conversion pages</h2>
        <p>Jump straight to a ready-made converter for a common conversion.</p>
''' + grid + '''      </div>
    </section>
'''
h = re.sub(r'    <section class="content" aria-labelledby="pages-title">.*?    </section>\n', lambda m: new, h, 1, flags=re.S)
open(D + 'index.html', 'w', encoding='utf-8').write(h)

# sitemap
sm = open('sitemap.xml', encoding='utf-8').read()
for p in P:
    loc = 'https://madebywaleed.com/' + D + p['slug'] + '/'
    if loc not in sm:
        a = '  <url><loc>https://madebywaleed.com/' + D + '</loc></url>\n'
        sm = sm.replace(a, a + '  <url><loc>%s</loc></url>\n' % loc, 1)
open('sitemap.xml', 'w', encoding='utf-8').write(sm)
print('built', len(P))

# re-apply the ad units to the freshly generated pages
import subprocess as _sp
_sp.run(["python3", "build/add_ads.py"], check=False)
