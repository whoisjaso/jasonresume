"""Builds index.html for the cinematic home page.

Head: the link and meta block from the previous index.html (git HEAD, or index.head.html if present),
with the title, description and share tags pointed at Obavia. JSON-LD: the home-page nodes from
schema.json plus faq.jsonld, so the page and the answer files never disagree.
Body: tools/site/home.body.html with three placeholders filled: %%ICONS%%, %%SOCIAL%%, %%COURSES%%.

Run from the repo root:  python3 tools/site/assemble_home.py
"""
import json, re, subprocess, pathlib, html

ROOT = pathlib.Path(__file__).resolve().parents[2]
BODY = ROOT / "tools/site/home.body.html"

def old_index():
    try:
        return subprocess.check_output(["git", "show", "HEAD:index.html"], cwd=ROOT, text=True)
    except Exception:
        return (ROOT / "index.html").read_text()

old = old_index()
head = old.split('<script type="application/ld+json">', 1)[0]

TITLE = "Jason Obawemimo | Founder of Obavia"
DESC = ("Jason Obawemimo is the founder of Obavia, sales software in development for agency owners at $100K to $1M a month, "
        "and the co-owner and operator of Triple J Auto Investment in Houston. He builds the systems underneath a business, then runs them.")
SHORT = "Founder of Obavia and co-owner of Triple J Auto Investment. I build the systems underneath a business, then I run them."
ALT = "Jason Obawemimo, founder of Obavia"

def sub_meta(h, attr, key, value):
    pat = re.compile(r'(<meta %s="%s" content=")[^"]*(" />)' % (attr, re.escape(key)))
    assert pat.search(h), key
    return pat.sub(lambda m: m.group(1) + html.escape(value, quote=True) + m.group(2), h, count=1)

head = re.sub(r"<title>.*?</title>", "<title>%s</title>" % TITLE, head, count=1)
head = sub_meta(head, "name", "description", DESC)
head = sub_meta(head, "property", "og:title", TITLE)
head = sub_meta(head, "property", "og:description", SHORT)
head = sub_meta(head, "property", "og:image:alt", ALT)
head = sub_meta(head, "name", "twitter:title", TITLE)
head = sub_meta(head, "name", "twitter:description", SHORT)
head = sub_meta(head, "name", "twitter:image:alt", ALT)
if "cinema.css" not in head:
    head = head.replace('<link rel="stylesheet" href="guide.css" />',
                        '<link rel="stylesheet" href="guide.css" />\n<link rel="stylesheet" href="cinema.css" />', 1)
if "jason-headshot-1200.webp" not in head:
    head = head.replace('<link rel="stylesheet" href="site.css" />',
                        '<link rel="preload" as="image" href="assets/jason-headshot-1200.webp" type="image/webp" />\n<link rel="stylesheet" href="site.css" />', 1)
if 'href="/obavia.html"' not in head:
    head = head.replace('<link rel="manifest"', '<link rel="alternate" type="text/html" href="/obavia.html" title="Obavia, founded by Jason Obawemimo" />\n<link rel="manifest"', 1)

# JSON-LD
schema = json.loads((ROOT / "schema.json").read_text())
faq = json.loads((ROOT / "faq.jsonld").read_text())
HOME = "https://jasonobawemimo.com/#"
keep = []
for node in schema["@graph"]:
    nid = node.get("@id", "")
    if nid.startswith(HOME):
        keep.append(node)
faq = dict(faq)
faq.pop("@context", None)
faq["@id"] = HOME + "faq"
faq.setdefault("url", "https://jasonobawemimo.com/")
keep.append(faq)
ld = json.dumps({"@context": "https://schema.org", "@graph": keep}, indent=2, ensure_ascii=False)
ld = ld.replace("</", "<\\/")

# Body pieces
body = BODY.read_text()
defs = re.search(r'<svg width="0" height="0".*?</svg>', old, re.S).group(0)
extra = ('    <g id="i-play" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></g>\n'
         '    <g id="i-sound" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></g>\n  </defs>')
if 'id="i-play"' not in defs:
    defs = defs.replace("  </defs>", extra, 1)
row = re.search(r'<span class="label">Elsewhere</span><div>(.*?)<a href="/jason-obawemimo-knowledge-card.html">', old, re.S)
social = row.group(1) if row else ""
assert social.count("social-link") >= 3, "social links not found"
courses = re.search(r'<span>Claude 101</span>.*?</span>(?=\s*</)', old, re.S)
if courses:
    ctext = courses.group(0)
else:
    ctext = (ROOT / "tools/site/courses.html").read_text().strip()
(ROOT / "tools/site/courses.html").write_text(ctext + "\n")
(ROOT / "tools/site/icons.html").write_text(defs + "\n") if 'id="i-play"' in defs else None
body = body.replace("%%ICONS%%", defs).replace("%%SOCIAL%%", social).replace("%%COURSES%%", ctext + ctext)
assert "%%" not in body

out = head + '<script type="application/ld+json">\n' + ld + "\n</script>\n</head>\n" + body
(ROOT / "index.html").write_text(out)
print("index.html", len(out), "bytes,", len(keep), "JSON-LD nodes")
