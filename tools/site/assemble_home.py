"""Builds index.html for the rebuilt home page (The Screening).

Head: tools/site/home.head.html (meta, share tags, alternates), then fonts, the
stylesheets, and JSON-LD made from schema.json plus faq.jsonld so the page and
the answer files never disagree.
Body: tools/site/home.body.html with its placeholders filled from
tools/site/record.json, the single source for the Slate, the record, the deck
and the PDF.

Run from anywhere:  python3 tools/site/assemble_home.py
"""
import html
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SITE = ROOT / "tools/site"
E = lambda s: html.escape(s, quote=True)

rec = json.loads((SITE / "record.json").read_text())
head = (SITE / "home.head.html").read_text()
body = (SITE / "home.body.html").read_text()

# Fonts and styles
head += (
    '<link rel="preconnect" href="https://fonts.googleapis.com" />\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500'
    '&family=Hanken+Grotesk:wght@400;500;600&display=swap" rel="stylesheet" />\n'
    '<link rel="preload" as="image" href="assets/jason-headshot-900.webp" type="image/webp" fetchpriority="high" />\n'
    '<link rel="stylesheet" href="tokens.css?v=%(v)s" />\n'
    '<link rel="stylesheet" href="home.css?v=%(v)s" />\n'
    '<link rel="stylesheet" href="print.css" media="print" />\n'
    '<script>document.documentElement.classList.add("js")</script>\n'
) % {"v": "s1"}

# JSON-LD: the home-page nodes of schema.json plus the FAQ
schema = json.loads((ROOT / "schema.json").read_text())
faq = json.loads((ROOT / "faq.jsonld").read_text())
HOME = "https://jasonobawemimo.com/#"
nodes = [n for n in schema["@graph"] if n.get("@id", "").startswith(HOME)]
faq = dict(faq)
faq.pop("@context", None)
faq["@id"] = HOME + "faq"
faq.setdefault("url", "https://jasonobawemimo.com/")
nodes.append(faq)
ld = json.dumps({"@context": "https://schema.org", "@graph": nodes}, indent=2, ensure_ascii=False).replace("</", "<\\/")
head += '<script type="application/ld+json">\n' + ld + "\n</script>\n</head>\n"


def slate():
    return "".join('<div><dt>%s</dt><dd>%s</dd></div>' % (E(r["k"]), E(r["v"])) for r in rec["slate"])


def chip(p):
    ext = ' target="_blank" rel="noopener"' if p.get("ext") else ""
    return '<a class="chip chip--proof" href="%s"%s data-proof="%s">%s</a>' % (E(p["href"]), ext, E(p["label"]), E(p["label"]))


def record():
    out = []
    for r in rec["record"]:
        when = '<p class="entry__when">%s</p>' % E(r["when"]) if r.get("when") else ""
        out.append(
            '<li class="entry" data-entry="%s"><div class="entry__head"><h3 class="entry__role">%s</h3><p class="entry__org">%s</p>%s</div>'
            '<p class="entry__text">%s</p><p class="entry__proof">%s</p></li>'
            % (E(r["id"]), E(r["role"]), E(r["org"]), when, E(r["text"]), " ".join(chip(p) for p in r.get("proof", [])))
        )
    return "".join(out)


def verify():
    out = []
    for v in rec["verify"]:
        ext = ' target="_blank" rel="noopener"' if v["href"].startswith("http") else ""
        out.append('<li><a href="%s"%s data-verify="%s"><b>%s</b> <span>%s</span></a></li>' % (E(v["href"]), ext, E(v["kind"]), E(v["k"]), E(v["v"])))
    return "".join(out)


icons = (SITE / "icons.html").read_text().strip()
deck_json = json.dumps({"deck": rec["deck"], "slate": rec["slate"], "verify": rec["verify"], "email": rec["email"], "calendar": rec["calendar"], "pdf": rec["pdf"]}, ensure_ascii=False).replace("</", "<\\/")

body = (
    body.replace("%%ICONS%%", icons + '\n<script type="application/json" id="record-data">' + deck_json + "</script>")
    .replace("%%SLATE%%", slate())
    .replace("%%RECORD%%", record())
    .replace("%%COURSES%%", "".join("<li>%s</li>" % E(c) for c in rec["courses"]))
    .replace("%%VERIFY%%", verify())
    .replace("%%LINE%%", E(rec["line"]))
    .replace("%%PDF%%", E(rec["pdf"]))
    .replace("%%EMAIL%%", E(rec["email"]))
    .replace("%%CALENDAR%%", E(rec["calendar"]))
)
assert "%%" not in body, [l for l in body.splitlines() if "%%" in l][:3]
out = head + body
(ROOT / "index.html").write_text(out)
print("index.html", len(out), "bytes,", len(nodes), "JSON-LD nodes")
