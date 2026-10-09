"""Builds index.html: the After Hours Library.

Head: tools/site/home.head.html (meta, share tags, alternates), then fonts, the
stylesheets, the first plate's preload, and JSON-LD made from schema.json plus
faq.jsonld so the page and the answer files never disagree.
Body: tools/site/home.body.html with its placeholders filled from
tools/site/library.json (the titles, trophies, profile and loadout) and
tools/site/record.json (the deck, Check me, the PDF, email and calendar).
Everything the game shows is rendered here as plain HTML first; game.js only
arranges and reveals it, so crawlers and screen readers get the whole record.

Also syncs into /obavia.html: the title screen's head script and data, and the
shared icon and glyph sheet.

Run from anywhere:  python3 tools/site/assemble_home.py
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SITE = ROOT / "tools/site"
E = lambda s: html.escape(str(s), quote=True)
V = "g2"

rec = json.loads((SITE / "record.json").read_text())
lib = json.loads((SITE / "library.json").read_text())
lib.pop("_about", None)
onboarding = json.loads((SITE / "onboarding.json").read_text())
onboarding.pop("_about", None)
builds = json.loads((SITE / "builds.json").read_text())
builds.pop("_about", None)
builds_json = json.dumps(builds, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
head = (SITE / "home.head.html").read_text()
body = (SITE / "home.body.html").read_text()
ART = "assets/game/art/"
placeholders = {}
try:
    placeholders = json.loads((ROOT / ART / "placeholders.json").read_text())
except Exception:
    pass
# where each plate's phone crop sits (tools/art/grade.py): the loop's position on a phone
frames = {}
try:
    frames = json.loads((ROOT / ART / "frames.json").read_text())
except Exception:
    pass


def has(p):
    return (ROOT / p).exists()


# Each title's key art files are named by its "art" stem when library.json gives
# one, else by its id. /assets/ is served immutable for a year, so a regraded
# plate ships under a new stem rather than over the old files. intro.js and
# build.js read the same map from the onboarding data (arts), and the title
# screen's default art (onboarding.json "art", named by title id) resolves here.
STEM = {t["id"]: t.get("art") or t["id"] for t in lib["titles"]}
onboarding["arts"] = {k: v for k, v in STEM.items() if v != k}
_m = re.match(r"^assets/game/art/([a-z0-9-]+)$", onboarding.get("art", ""))
if _m and _m.group(1) in STEM:
    onboarding["art"] = ART + STEM[_m.group(1)]
if onboarding.get("art"):
    assert has(onboarding["art"] + "-1920.webp") and has(onboarding["art"] + "-m.webp"), "title screen art missing: " + onboarding["art"]

# The walkthrough: the narrated film (tools/film/render-tour.sh) and the guided
# tour's lines and timings (tools/voice/timeline.mjs writes tools/site/tour.json).
# The title screen offers the film only once it has been rendered.
TOUR = {}
try:
    TOUR = json.loads((SITE / "tour.json").read_text())
except Exception:
    pass
FILM = "assets/film/tour"
if has(FILM + ".mp4"):
    walk = {"src": FILM + ".mp4", "poster": FILM + ".jpg", "note": TOUR.get("label", ""), "page": "/walkthrough.html", "page_label": "The film page"}
    if has(FILM + "-vertical.mp4"):
        walk.update({"vsrc": FILM + "-vertical.mp4", "vposter": FILM + "-vertical.jpg"})
    if has(FILM + ".vtt"):
        walk["vtt"] = FILM + ".vtt"
    onboarding["walk"] = walk
onboarding_json = json.dumps(onboarding, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


# The title screen plays for every arrival from outside the site, on whichever
# page the visitor lands (home or /obavia.html); clicks between the site's own
# pages skip it, crawlers skip it, ?intro=1 forces it. Shared by both pages.
HEAD_SCRIPT = (
    '<script>(function(){var d=document.documentElement;d.classList.add("js");'
    'try{var r=document.referrer,inside=false;try{inside=!!r&&new URL(r).host===location.host}catch(e){}'
    'if(!/bot|crawl|spider|slurp|lighthouse|preview|facebookexternalhit/i.test(navigator.userAgent)&&(!inside||/[?&]intro=1/.test(location.search)))d.classList.add("intro-pending")}catch(e){}'
    'setTimeout(function(){if(!document.getElementById("intro"))d.classList.remove("intro-pending")},5000)})()</script>'
)

first = STEM[lib["titles"][0]["id"]]
head += (
    '<link rel="preconnect" href="https://fonts.googleapis.com" />\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600'
    '&family=Hanken+Grotesk:wght@300;400;500;600&display=swap" rel="stylesheet" />\n'
    '<link rel="preload" as="image" href="' + ART + first + '-1920.webp" type="image/webp" media="(min-width: 761px)" fetchpriority="high" />\n'
    '<link rel="preload" as="image" href="' + ART + first + '-m.webp" type="image/webp" media="(max-width: 760px)" fetchpriority="high" />\n'
    '<link rel="stylesheet" href="game.css?v=' + V + '" />\n'
    '<link rel="stylesheet" href="desk.css?v=' + V + '" />\n'
    '<link rel="stylesheet" href="build.css?v=' + V + '" />\n'
    + HEAD_SCRIPT + "\n"
)

# The loading screen: the line drawing (tools/art/boot.py) and its engine
# (tools/site/boot.js, inlined so it runs while the page parses)
boot_js = re.sub(r"/\*.*?\*/", "", (SITE / "boot.js").read_text(), flags=re.S)
boot_js = "\n".join(l.strip() for l in boot_js.splitlines() if l.strip())
WATCH_BTN = ('<button class="boot__watch" type="button" data-watch><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-select"/></svg>%s</button>'
             % E(onboarding["title"].get("watch", "Watch the walkthrough"))) if onboarding.get("walk") else ""
BOOT = ((SITE / "boot.html").read_text()
        .replace("%%BOOT_ART%%", E(onboarding.get("art", "")))
        .replace("%%BOOT_FILM%%", WATCH_BTN)
        .replace("%%BOOT_JS%%", boot_js.replace("</", "<\\/")))

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

TR = lib["trophies"]
TIER = {"bronze": "Bronze", "silver": "Silver", "gold": "Gold", "platinum": "Platinum"}
TITLES = {t["id"]: t for t in lib["titles"]}
mailto = "mailto:%s?subject=Your%%20site%%2C%%20and%%20a%%20role" % rec["email"]


def medal(slug, size):
    src = "assets/game/medals/%s-%d.webp" % (slug, 160 if size > 60 else 80)
    return '<img class="medal medal--%s" src="%s" alt="" width="%d" height="%d" loading="lazy" decoding="async" />' % (TR[slug]["tier"], src, size, size)


def trophy_li(slug, size=64):
    t = TR[slug]
    desc = E(t["desc"])
    if t.get("href"):
        desc += ' <a href="%s" data-proof="%s">See the proof</a>' % (E(t["href"]), E(t["name"]))
    return '<li class="trophy" data-trophy="%s" data-tier="%s">%s<div><b>%s<small>%s</small></b><p>%s</p></div></li>' % (
        slug, t["tier"], medal(slug, size), E(t["name"]), TIER[t["tier"]], desc)


def plates():
    out = []
    for i, t in enumerate(lib["titles"]):
        tid = t["id"]
        st = STEM[tid]
        if not has(ART + st + "-1920.webp"):
            out.append('<div class="plate" data-plate="%s"></div>' % tid)
            continue
        ph = placeholders.get(st)
        css = []
        if ph:
            css.append("background:url(%s) center/cover" % ph)
        # on a phone the still is the portrait crop and the loop the whole frame:
        # --lx puts the loop over the same part of the frame (game.css, max-width 760px)
        if isinstance(frames.get(st), dict) and frames[st].get("loop_x") is not None:
            css.append("--lx:%s%%" % frames[st]["loop_x"])
        style = ' style="%s"' % ";".join(css) if css else ""
        eager = i == 0
        img = (
            '<picture><source media="(max-width: 760px)" srcset="%(a)s%(id)s-m.webp" />'
            '<img class="plate__img" src="%(a)s%(id)s-1920.webp" srcset="%(a)s%(id)s-1280.webp 1280w, %(a)s%(id)s-1920.webp 1920w" sizes="100vw" alt="" decoding="async"%(load)s /></picture>'
            % {"a": ART, "id": st, "load": ' fetchpriority="high"' if eager else ' loading="lazy"'}
        )
        vid = ""
        if has("assets/game/loops/%s.mp4" % st):
            webm = ' data-webm="assets/game/loops/%s.webm"' % st if has("assets/game/loops/%s.webm" % st) else ""
            vid = '<video class="plate__loop" muted playsinline loop preload="none" data-mp4="assets/game/loops/%s.mp4"%s></video>' % (st, webm)
        out.append('<div class="plate%s" data-plate="%s"%s>%s%s</div>' % (" is-on" if eager else "", tid, style, img, vid))
    return "".join(out)


def tiles():
    out = []
    for i, t in enumerate(lib["titles"]):
        tid = t["id"]
        size = "sm" if not t.get("career") else "md"
        src = ART + STEM[tid] + "-tile-256.webp"
        img = ('<img class="tile__img" src="%s" srcset="%s 256w, %s 512w" sizes="(max-width: 899px) 96px, 162px" alt="" width="256" height="256" decoding="async" />'
               % (src, src, ART + STEM[tid] + "-tile-512.webp")) if has(src) else '<span class="tile__img"></span>'
        tag = '<span class="tile__tag">%s</span>' % E(t["tag"]) if t.get("tag") else ""
        out.append(
            '<li><a class="tile%s" href="#title/%s" data-title="%s" data-size="%s" aria-label="%s"%s><span class="tile__frame">%s</span><span class="tile__name">%s</span>%s</a></li>'
            % (" is-focus" if i == 0 else "", tid, tid, size, E(t["logo"] + ". " + t["kind"] + (". " + t["tag"] if t.get("tag") else "") + "."), "" if i == 0 else ' tabindex="-1"', img, E(t["logo"]), tag)
        )
    return "".join(out)


DESK_NOTES = (
    '<ol class="steps" data-desk-notes>'
    '<li data-note="car"><b>Pick the car.</b> From the lot, in one tap.</li>'
    '<li data-note="odo"><b>The odometer.</b> Read back so nobody fat-fingers it.</li>'
    '<li data-note="scan"><b>Scan the license once.</b> Name, address and license number land on every form.</li>'
    '<li data-note="pay"><b>How they\'re paying.</b> Cash, buy here pay here, or the bank.</li>'
    '<li data-note="money"><b>The money.</b> Tax, title, registration and the doc fee, worked out live.</li>'
    '<li data-note="docs"><b>The paperwork.</b> Only the forms this deal needs.</li>'
    '<li data-note="sign"><b>Signed at the desk.</b> The buyer reads, signs with a finger, done.</li>'
    "</ol>"
)


def title_article(i, t):
    tid = t["id"]
    secs, tabs = [], []

    def sec(key, label, inner):
        sid = "%s-%s" % (tid, key)
        tabs.append('<a href="#%s" data-tab="%s">%s</a>' % (sid, key, E(label)))
        secs.append('<section class="sec" id="%s" data-sec="%s" aria-labelledby="%s-h"><h3 class="sec__h" id="%s-h">%s</h3>%s</section>' % (sid, key, sid, sid, E(label), inner))

    ov = '<ul class="points">' + "".join("<li>%s</li>" % E(p) for p in t.get("overview", [])) + "</ul>"
    if t.get("details"):
        ov += '<dl class="details">' + "".join(
            "<div><dt>%s</dt><dd>%s</dd></div>" % (E(d["k"]), ('<a href="%s" target="_blank" rel="noopener">%s</a>' % (E(d["href"]), E(d["v"]))) if d.get("href") else E(d["v"]))
            for d in t["details"]) + "</dl>"
    if t.get("proof"):
        ov += '<p class="proof">' + "".join('<a class="btn btn--sm" href="%s" data-verify="%s" data-where="title">%s</a>' % (E(p["href"]), E(p.get("verify", "")), E(p["label"])) for p in t["proof"]) + "</p>"
    if t.get("actions"):
        ov += '<p class="proof">' + "".join(
            '<a class="btn btn--sm" href="%s"%s>%s</a>' % (E(a["href"]), (' data-contact="%s" data-where="obavia"' % a["contact"]) if a.get("contact") else (' data-cta="%s"' % a["cta"] if a.get("cta") else ""), E(a["label"]))
            for a in t["actions"]) + "</p>"
    sec("overview", "Overview", ov)
    if t.get("film"):
        f = t["film"]
        sec("film", "Film", '<figure class="film"><video controls playsinline preload="none" poster="%s" src="%s" aria-label="%s"></video><figcaption>%s. %s</figcaption></figure>' % (E(f["poster"]), E(f["src"]), E(f["title"]), E(f["title"]), E(f["note"])))
    if t.get("demo"):
        sec("demo", "Play the sale desk", '<div class="demo"><div class="iphone" data-desk-app aria-label="The sale desk I built, running a sale with a fictional buyer and example figures"></div><div><p class="demo__note">Sell a car on the desk I built. Fictional buyer, example figures.</p>' + DESK_NOTES + "</div></div>")
    if t.get("trophies"):
        sec("trophies", "Trophies", '<ul class="tlist">' + "".join(trophy_li(s) for s in t["trophies"]) + "</ul>")
    elif tid == "obavia":
        sec("trophies", "Trophies", '<p class="empty">No trophies yet. It isn\'t live.</p>')
    if t.get("stack"):
        sec("stack", "Loadout", '<ul class="stack">' + "".join("<li>%s</li>" % E(s) for s in t["stack"]) + "</ul>")

    stats = ""
    if t.get("stats"):
        stats = '<dl class="title__stats">' + "".join('<div class="stat"><dt>%s</dt><dd>%s</dd></div>' % (E(s["k"]), E(s["n"])) for s in t["stats"]) + "</dl>"
        if t.get("stats_note"):
            stats += '<p class="title__note">%s</p>' % E(t["stats_note"])
    tag = '<p class="title__tag">%s</p>' % E(t["tag"]) if t.get("tag") else ""
    acts = (
        '<div class="title__acts">'
        '<a class="btn btn--primary" href="#title/%s" data-open-title="%s"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-select"/></svg>Open</a>'
        '<a class="btn" href="%s" data-resume="pdf" data-where="title" download="Jason Obawemimo - Resume.pdf">Resume PDF</a>'
        '<a class="btn" href="%s" data-contact="email" data-where="title">Email me</a>'
        "</div>" % (tid, tid, E(rec["pdf"]), E(mailto))
    )
    keys = '<span class="key key--q" aria-hidden="true">Q</span>' + "".join(tabs) + '<span class="key key--e" aria-hidden="true">E</span>'
    return (
        '<article class="title%s" id="title-%s" data-title="%s" aria-labelledby="h-%s" data-track="title-%s">'
        '<a class="btn btn--ghost title__back" href="#library" data-back><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-back"/></svg>Back</a>'
        '<header class="title__head"><h2 class="title__logo" id="h-%s">%s</h2>%s<p class="title__role">%s</p><p class="title__sum">%s</p>%s%s</header>'
        '<div class="title__body"><nav class="tabs" aria-label="%s sections">%s</nav>%s'
        "</div></article>"
        % (" is-focus" if i == 0 else "", tid, tid, tid, tid, tid, E(t["logo"]), tag, E(t["role"]), E(t["summary"]), stats, acts, E(t["logo"]), keys, "".join(secs))
    )


def trophy_groups():
    out = []
    for t in lib["titles"]:
        if not t.get("trophies"):
            continue
        out.append('<div class="tgroup"><h3>%s</h3><ul class="tlist">%s</ul></div>' % (E(t["logo"]), "".join(trophy_li(s, 56) for s in t["trophies"])))
    out.append('<div class="tgroup"><h3>Platinum</h3><ul class="tlist">%s</ul></div>' % trophy_li(lib["platinum"], 56))
    return "".join(out)


def profile():
    p = lib["profile"]
    portrait = "assets/game/portrait/jason-relit-800.webp"
    img = ('<img src="%s" alt="Jason Obawemimo, in a dark green suit and glasses" width="800" height="960" loading="lazy" decoding="async" />' % portrait) if has(portrait) else '<img src="assets/jason-headshot-620.webp" alt="Jason Obawemimo, in a dark green suit and glasses" width="620" height="620" loading="lazy" />'
    loadout = '<dl class="loadout">' + "".join("<div><dt>%s</dt><dd>%s</dd></div>" % (E(s["slot"]), E(", ".join(s["items"]))) for s in p["loadout"]) + "</dl>"
    links = '<ul class="links">' + "".join(
        '<li><a href="%s"%s%s><b>%s</b><span>%s</span></a></li>' % (
            E(l["href"]), ' target="_blank" rel="noopener"' if l.get("ext") else "",
            (' data-contact="%s" data-where="profile"' % l["contact"]) if l.get("contact") else (' data-verify="%s" data-where="profile"' % l["verify"] if l.get("verify") else ""),
            E(l["k"]), E(l["v"]))
        for l in p["links"]) + "</ul>"
    return (
        '<a class="btn btn--ghost screen__back" href="#library" data-back><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-back"/></svg>Back</a>'
        '<div class="profile__grid">'
        '<figure class="profile__portrait">%s</figure>'
        '<div class="profile__main">'
        '<header class="screen__head"><h2 class="screen__h" id="profile-h">%s</h2><p class="screen__sub">%s. %s.</p></header>'
        '<p class="profile__lvl"><b>%s</b><span>%s Library <span data-library-count>0 of 5</span> opened.</span></p>'
        '<p class="profile__bio">%s</p>'
        '<p class="title__acts"><a class="btn btn--primary" href="%s" data-resume="pdf" data-where="profile" download="Jason Obawemimo - Resume.pdf"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-doc"/></svg>Resume PDF</a><a class="btn" href="#present" data-open="deck" data-where="profile">Present the resume</a><a class="btn" href="#verify" data-open="verify" data-where="profile">Check me</a></p>'
        '<h3 class="sec__h" style="margin-top:40px">Loadout</h3>%s'
        '<h3 class="sec__h" style="margin-top:40px">Contact</h3>%s'
        '<p class="credits-inline">%s</p>'
        "</div></div>"
        % (img, E(p["name"]), E(p["title"]), E(p["place"]), E(p["level_label"]), E(p["level_note"]), E(p["bio"]), E(rec["pdf"]), loadout, links, E(music_credits()))
    )


def music_credits():
    try:
        return json.loads((ROOT / "assets/score/score.json").read_text()).get("credits", "")
    except Exception:
        return "The score is composed in code and played from sampled instruments."


def icon(ic):
    if not ic:
        return ""
    if "sym" in ic:
        return '<span class="appicon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" style="fill:currentColor"><use href="#%s"/></svg></span>' % ic["sym"]
    if "src" in ic:
        return '<span class="appicon" aria-hidden="true"><img src="%s" alt="" loading="lazy" /></span>' % E(ic["src"])
    return ""


def verify():
    out = []
    for v in rec["verify"]:
        ext = ' target="_blank" rel="noopener"' if v["href"].startswith("http") else ""
        out.append('<li><a class="row" href="%s"%s data-verify="%s">%s<span class="row__txt"><b>%s</b> <span>%s</span></span><i class="row__chev" aria-hidden="true"></i></a></li>' % (E(v["href"]), ext, E(v["kind"]), icon(v.get("icon")), E(v["k"]), E(v["v"])))
    return "".join(out)


def readings():
    out = []
    for b in builds["builds"]:
        slug = "Jason_Obawemimo_Resume_" + re.sub(r"[^A-Za-z0-9]+", "_", b["label"]) + ".pdf" + (("?v=" + rec["pdf"].split("?v=")[1]) if "?v=" in rec["pdf"] else "")
        out.append('<li><a class="row" href="resume/%s.html"><span class="row__txt"><b>%s</b> <span>%s Written for %s.</span></span><i class="row__chev" aria-hidden="true"></i></a> <a class="readings__pdf" href="assets/resume/%s" download>PDF</a></li>'
                   % (E(b["id"]), E(b["label"]), E(b["headline"]), E(", ".join(b["targets"])), E(slug)))
    return "".join(out)


def legend():
    out = []
    for l in lib["legend"]:
        out.append('<span>%s %s</span>' % ("".join('<span class="key">%s</span>' % E(k) for k in l["keys"]), E(l["label"])))
    return "".join(out)


icons = (SITE / "icons.html").read_text().strip() + "\n" + (SITE / "glyphs.html").read_text().strip()
deck_json = json.dumps({"deck": rec["deck"], "slate": rec["slate"], "verify": rec["verify"], "email": rec["email"], "calendar": rec["calendar"], "pdf": rec["pdf"]}, ensure_ascii=False).replace("</", "<\\/")
lib_json = dict(lib)
lib_json["pdf"] = rec["pdf"]
lib_json["email"] = rec["email"]
lib_json = json.dumps(lib_json, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
n_trophies = len(TR)

body = (
    body.replace("%%ICONS%%", icons
                 + '\n<script type="application/json" id="record-data">' + deck_json + "</script>"
                 + '\n<script type="application/json" id="library-data">' + lib_json + "</script>"
                 + '\n<script type="application/json" id="onboarding-data">' + onboarding_json + "</script>"
                 + '\n<script type="application/json" id="builds-data">' + builds_json + "</script>"
                 + ('\n<script type="application/json" id="tour-data">' + json.dumps(TOUR, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>" if TOUR else ""))
    .replace("%%BOOT%%", BOOT.strip())
    .replace("%%HELP_WATCH%%", '<a class="btn btn--sm btn--ghost" href="/walkthrough.html">%s</a>' % E(onboarding["title"].get("watch", "Watch the walkthrough")) if onboarding.get("walk") else "")
    .replace("%%PLATES%%", plates())
    .replace("%%TILES%%", tiles())
    .replace("%%TITLES%%", "".join(title_article(i, t) for i, t in enumerate(lib["titles"])))
    .replace("%%TROPHY_GROUPS%%", trophy_groups())
    .replace("%%PROFILE%%", profile())
    .replace("%%VERIFY%%", verify())
    .replace("%%LEGEND%%", legend())
    .replace("%%READINGS%%", readings())
    .replace("%%MUSIC_CREDITS%%", E(music_credits()))
    .replace("%%LEVEL_NOTE%%", E(lib["profile"]["level_note"]))
    .replace("%%LEVEL%%", E(lib["profile"]["level"]))
    .replace("%%TROPHY_COUNT%%", str(n_trophies))
    .replace("%%PDF%%", E(rec["pdf"]))
    .replace("%%EMAIL%%", E(rec["email"]))
    .replace("%%CALENDAR%%", E(rec["calendar"]))
)
assert "%%" not in body, [l for l in body.splitlines() if "%%" in l][:3]
out = head + body
(ROOT / "index.html").write_text(out)
print("index.html", len(out), "bytes,", len(nodes), "JSON-LD nodes,", n_trophies, "trophies")


# The Obavia page carries the same title screen: sync its head script and data.
ob = ROOT / "obavia.html"
o = ob.read_text()
data_tag = '<script type="application/json" id="onboarding-data">' + onboarding_json + "</script>"
o2 = re.sub(r"<!-- onboarding:head -->.*?<!-- /onboarding:head -->", lambda m: "<!-- onboarding:head -->" + HEAD_SCRIPT + "<!-- /onboarding:head -->", o, flags=re.S)
o2 = re.sub(r"<!-- onboarding:data -->.*?<!-- /onboarding:data -->", lambda m: "<!-- onboarding:data -->" + data_tag + "<!-- /onboarding:data -->", o2, flags=re.S)
o2 = re.sub(r"<!-- icons -->.*?<!-- /icons -->", lambda m: "<!-- icons -->" + icons + "<!-- /icons -->", o2, flags=re.S)
o2 = re.sub(r"<!-- boot -->.*?<!-- /boot -->", lambda m: "<!-- boot -->" + BOOT.strip() + "<!-- /boot -->", o2, flags=re.S)
if o2 != o:
    ob.write_text(o2)
    print("obavia.html title screen synced")


# The walkthrough's own page: the film, the vertical cut, and the words as a
# transcript (the film's lines in order), so it reads without the video too.
if onboarding.get("walk"):
    W = onboarding["walk"]
    tl = json.loads((SITE.parent / "voice/tour_lines.json").read_text())
    L = {l["id"]: l["text"] for l in tl["lines"]}
    transcript = "".join("<li>%s</li>" % E(L[s_["line"]]) for s_ in tl["film"])
    track = '<track kind="captions" srclang="en" label="English" src="%s" />' % E(W["vtt"]) if W.get("vtt") else ""
    vert = ('<p class="walk__alt"><a href="%s">The vertical cut</a>, for a phone.</p>' % E(W["vsrc"])) if W.get("vsrc") else ""
    page = (
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\" />\n"
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />\n'
        "<title>The walkthrough | Jason Obawemimo</title>\n"
        '<meta name="description" content="A narrated walkthrough of jasonobawemimo.com: the title screen, the build, the library, the sale desk, the trophies, Player 2 and the resume." />\n'
        '<link rel="canonical" href="https://jasonobawemimo.com/walkthrough.html" />\n'
        '<meta name="theme-color" content="#0a0d0b" />\n<link rel="icon" href="/favicon.ico" />\n'
        '<meta property="og:type" content="video.other" />\n<meta property="og:title" content="The walkthrough | Jason Obawemimo" />\n'
        '<meta property="og:image" content="https://jasonobawemimo.com/%s" />\n<meta property="og:video" content="https://jasonobawemimo.com/%s" />\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
        '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Hanken+Grotesk:wght@300;400;500;600&display=swap" rel="stylesheet" />\n'
        '<link rel="stylesheet" href="game.css?v=%s" />\n</head>\n'
        '<body class="lib walk">\n<main class="walk__main">\n'
        '<a class="btn btn--ghost walk__back" href="/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>The library</a>\n'
        '<h1 class="walk__h">The walkthrough</h1>\n<p class="walk__sub">%s</p>\n'
        '<figure class="walk__film"><video controls playsinline preload="metadata" poster="%s" src="%s">%s</video></figure>\n%s'
        '<h2 class="walk__k">What the narrator says</h2>\n<ol class="walk__lines">%s</ol>\n'
        '<p class="walk__fine">Every frame is the live site, captured as it is. Every fact in it is in <a href="/llms.txt">llms.txt</a>.</p>\n'
        "</main>\n</body>\n</html>\n"
        % (E(W["poster"]), E(W["src"]), V, E(W.get("note", "")), E(W["poster"]), E(W["src"]), track, vert, transcript)
    )
    (ROOT / "walkthrough.html").write_text(page)
    print("walkthrough.html written")
