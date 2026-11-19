#!/usr/bin/env python3
"""Adds the AdSense side rails and the bottom unit to every tool page (not hubs, not privacy pages).
Safe to run again: pages that already have the rails are skipped. Run from the repo root."""
import re, subprocess
RAIL_L = '''  <aside class="mbw-rail mbw-rail-l" aria-label="Advertisement"><span class="mbw-ad-label">Advertisement</span>
    <!-- madebywaleed-display-leftsidebar-r -->
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-1356293872894760" data-ad-slot="6181882004" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>
  <aside class="mbw-rail mbw-rail-r" aria-label="Advertisement"><span class="mbw-ad-label">Advertisement</span>
    <!-- madebywaleed-display-rightsidebar-r -->
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-1356293872894760" data-ad-slot="9679044350" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>
'''
BOTTOM = '''  <div class="mbw-ad-bottom" aria-label="Advertisement"><span class="mbw-ad-label">Advertisement</span>
    <ins class="adsbygoogle" style="display:block" data-ad-format="autorelaxed" data-ad-client="ca-pub-1356293872894760" data-ad-slot="5587147711"></ins></div>
'''
HUBS = {'tools/index.html','tools/device-testers/index.html','tools/converters/index.html','tools/calculators/index.html','tools/utilities/index.html','tools/converters/document-converter/Privacy/index.html'}
files = [f for f in subprocess.check_output("git ls-files 'tools/*/index.html' 'tools/*/*/index.html' 'tools/*/*/*/index.html'", shell=True, text=True).split() if f not in HUBS]
n = 0
for f in files:
    s = open(f, encoding='utf-8').read()
    if 'mbw-rail' in s: continue
    if '<footer' not in s or not re.search(r'<body[^>]*>', s): print('skip', f); continue
    s = s.replace('</head>', '  <link rel="stylesheet" href="/ads.css">\n  <script defer src="/ads.js"></script>\n</head>', 1)
    s = re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + '\n' + RAIL_L, s, 1)
    i = s.rfind('<footer')
    ls = s.rfind('\n', 0, i) + 1
    s = s[:ls] + BOTTOM + s[ls:]
    open(f, 'w', encoding='utf-8').write(s); n += 1
print('ads added to', n, 'pages of', len(files))

# In-article unit: placed between the first and second text block of pages that have one.
INART = '''      <div class="mbw-ad-inart"><span class="mbw-ad-label">Advertisement</span>
        <ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="ca-pub-1356293872894760" data-ad-slot="3250639318"></ins></div>
'''
PATTERNS = ['<div class="glass content-card"', '<div class="tbox tguide"', '<div class="tbox" style="background:transparent']
m = 0; missed = []
for f in files:
    s = open(f, encoding='utf-8').read()
    if 'mbw-ad-inart' in s: continue
    done = False
    for pat in PATTERNS:
        idx = [x.start() for x in re.finditer(re.escape(pat), s)]
        if len(idx) >= 2:
            ls = s.rfind('\n', 0, idx[1]) + 1
            s = s[:ls] + INART + s[ls:]; done = True; break
    if done: open(f, 'w', encoding='utf-8').write(s); m += 1
    else: missed.append(f)
print('in-article unit added to', m, 'pages; without a second text block:', len(missed))
for f in missed: print('  ', f)
