#!/usr/bin/env python3
"""Apply the shared header partial to every HTML page in the repo.

Usage: python3 build/build.py
- Replaces each <header class="site-header"> block with build/partials/header.html.
- Replaces each <footer class="site-footer"> block with build/partials/footer.html.
  Pages with no site-footer block (and the converter pages, which have their own
  footer design) are left as they are.
- Sets aria-current="page" on the top-level nav link for the page's section
  (Apps, Tools, Guides, About) and removes it from every other link.
- Safe to run more than once: a second run changes nothing.

"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PARTIAL = (ROOT / "build" / "partials" / "header.html").read_text(encoding="utf-8").rstrip("\n")
FOOTER_PARTIAL = (ROOT / "build" / "partials" / "footer.html").read_text(encoding="utf-8").rstrip("\n")
SKIP_DIRS = {"build", "node_modules", ".git"}

HEADER_RE = re.compile(r'<header class="site-header">.*?</header>', re.S)
FOOTER_RE = re.compile(r'<footer class="site-footer">.*?</footer>', re.S)
SECTIONS = {"apps": "/apps/", "tools": "/tools/", "guides": "/guides/", "about": "/about/", "support": "/support/"}


def section_for(rel_path: str):
    first = rel_path.strip("/").split("/", 1)[0]
    return first if first in SECTIONS else None


def mark_current(header: str, section):
    """Return the header with aria-current set on the top-level link for section.

    Top-level links are the desktop nav items (nav-dd-btn or plain links) and the
    Support button. Dropdown links and the mobile menu are left alone.
    """
    header = header.replace(' aria-current="page"', "")
    if section is None:
        return header
    target = SECTIONS[section]
    pattern = re.compile(
        r'<a class="(?:nav-dd-btn|button)" href="' + re.escape(target) + r'">'
        r'|<a href="' + re.escape(target) + r'">'
    )
    # Only the first match is the desktop top-level item, since the desktop nav comes first.
    match = pattern.search(header)
    if not match:
        return header
    tag = match.group(0)
    return header[:match.start()] + tag[:-1] + ' aria-current="page">' + header[match.end():]


def build_page(path: pathlib.Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if not HEADER_RE.search(text):
        return False
    rel = path.relative_to(ROOT).as_posix()
    section = section_for(rel)
    new_header = mark_current(PARTIAL, section)
    new_text = HEADER_RE.sub(lambda _m: new_header, text, count=1)
    new_text = FOOTER_RE.sub(lambda _m: FOOTER_PARTIAL, new_text, count=1)
    if new_text == text:
        return False
    path.write_text(new_text, encoding="utf-8")
    return True


def main():
    changed = []
    for path in sorted(ROOT.rglob("*.html")):
        if any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts):
            continue
        if build_page(path):
            changed.append(path.relative_to(ROOT).as_posix())
    print(f"updated {len(changed)} page(s)")
    for rel in changed:
        print("  " + rel)
    return 0


if __name__ == "__main__":
    sys.exit(main())
