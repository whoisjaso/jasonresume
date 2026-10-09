#!/usr/bin/env python3
"""Nine resumes from one record.

Reads tools/site/builds.json (the proofs and the eight builds), tools/site/record.json (the
summary and the resume block) and tools/site/resume.template.html, and writes:

  resume-pdf.html            the canonical resume (its URL, head metadata and JSON-LD kept)
  resume/<build>.html        one page per build, each read for a kind of role
  match.js                   the data block of the listing match (lexicon.json and builds.json)

Then node tools/verify/resume.mjs prints every page to its PDF and plain-text copy and gates them.

Every fact, number and date it prints must already be in llms.txt; the script checks the
numbers, the summaries and the headlines against llms.txt, and refuses em dashes, en dashes,
percent signs and anything shaped like a phone number.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "tools" / "site"
BASE = "https://jasonobawemimo.com"

builds_doc = json.loads((SITE / "builds.json").read_text())
rec = json.loads((SITE / "record.json").read_text())
lexicon = json.loads((SITE / "lexicon.json").read_text())
template = (SITE / "resume.template.html").read_text()
schema = json.loads((ROOT / "schema.json").read_text())
llms = (ROOT / "llms.txt").read_text()

R = rec["resume"]
PROOFS = builds_doc["proofs"]
BUILDS = builds_doc["builds"]
JOB_TITLE = "triple-j"
LEARN = "learn"
problems = []


def E(s):
    return html.escape(s, quote=True)


def fail(msg):
    problems.append(msg)


def file_stem(label):
    return "Jason_Obawemimo_Resume_" + re.sub(r"[^A-Za-z0-9]+", "_", label).strip("_")


CANON_STEM = "Jason_Obawemimo_Resume_2026"


def numbers(s):
    return [n.rstrip(".,") for n in re.findall(r"\d[\d,]*(?:\.\d+)?", s)]


LLMS_NUMBERS = set(numbers(llms))


def bullet(pid):
    """The resume form of a proof: its own bullet, the record's wording, or its line without the leading I."""
    p = PROOFS[pid]
    text = p.get("bullet") or R["bullets"].get(pid)
    if not text:
        text = p["text"]
        if text.startswith("I "):
            text = text[2:]
            text = text[0].upper() + text[1:]
    if sorted(numbers(text)) != sorted(numbers(p["text"])):
        fail("bullet %s changes a number: %r vs %r" % (pid, text, p["text"]))
    return text


def experience(proof_ids):
    job_level = []
    systems = {}
    order = []
    for pid in proof_ids:
        if pid not in PROOFS:
            fail("unknown proof " + pid)
            continue
        p = PROOFS[pid]
        if p["area"] == LEARN:
            continue
        t = p["title"]
        if t == JOB_TITLE:
            job_level.append(pid)
        elif t in R["systems"]:
            if t not in systems:
                systems[t] = []
                order.append(t)
            systems[t].append(pid)
        else:
            fail("proof %s has no place under the job (title %s)" % (pid, t))
    job = R["job"]
    out = ['    <section aria-labelledby="h-experience">', '      <h2 id="h-experience">Experience</h2>', '      <div class="job">']
    out.append('        <p class="row"><span class="role">%s</span> <span class="when">%s</span></p>' % (E(job["role"]), E(job["when"])))
    out.append('        <p class="org">%s, %s</p>' % (E(job["org"]), E(job["place"])))
    out.append('        <ul class="duties">')
    for pid in job_level:
        out.append('          <li data-proof="%s">%s</li>' % (pid, E(bullet(pid))))
    for t in order:
        s = R["systems"][t]
        out.append('          <li class="sys" data-system="%s"><strong>%s</strong> (%s)' % (t, E(s["name"]), E(s["stack"])))
        out.append("            <ul>")
        for pid in systems[t]:
            out.append('              <li data-proof="%s">%s</li>' % (pid, E(bullet(pid))))
        out.append("            </ul>")
        out.append("          </li>")
    out.append("        </ul>")
    out.append("      </div>")
    out.append("    </section>")
    return out


def education():
    out = ['    <section aria-labelledby="h-education">', '      <h2 id="h-education">Education</h2>']
    for ed in R["education"]:
        line2 = ed["degree"] + (", " + ed["note"] if ed.get("note") else "")
        out.append('      <div class="entry" data-proof="%s">' % ed["proof"])
        out.append('        <p class="row"><span><strong>%s</strong>, %s</span> <span class="when">%s</span></p>' % (E(ed["school"]), E(ed["place"]), E(ed["when"])))
        out.append("        <p>%s</p>" % E(line2))
        out.append("      </div>")
    out.append("    </section>")
    return out


def certificates(key):
    courses = R["courses"][key]
    for c in courses:
        if c not in rec["courses"]:
            fail("course not in record.json courses: " + c)
    out = ['    <section aria-labelledby="h-certificates">', '      <h2 id="h-certificates">Certificates and Courses</h2>', '      <ul class="plain">']
    out.append('        <li data-proof="google">%s</li>' % E(R["certificates"]["google"]))
    # Course names carry their own "and", so they are set apart with semicolons.
    out.append('        <li data-proof="anthropic">%s %s</li>' % (E(R["certificates"]["anthropic"]), E("; ".join(courses))))
    out.append("      </ul>")
    out.append("    </section>")
    return out


def skills(build_id, order):
    groups = {g["group"]: g for g in R["skills"]}
    names = [g["group"] for g in R["skills"] if build_id in g.get("lead_for", []) and g["group"] not in order]
    names += order
    out = ['    <section class="skills" aria-labelledby="h-skills">', '      <h2 id="h-skills">Skills</h2>']
    for n in names:
        if n not in groups:
            fail("unknown skills group " + n)
            continue
        out.append('      <p data-group="%s"><span class="k">%s:</span> %s</p>' % (E(n), E(n), E(groups[n]["items"])))
    out.append("    </section>")
    return out


def head_block(build):
    out = ['    <div class="head">', "      <h1>Jason Obawemimo</h1>", '      <p class="title">%s</p>' % E(R["title"])]
    if build:
        out.append('      <p class="headline">%s</p>' % E(build["headline"]))
        out.append('      <p class="for">Written for: %s</p>' % E(", ".join(build["targets"])))
    parts = []
    for c in R["contact"]:
        if c.get("href"):
            parts.append('<a href="%s">%s</a>' % (E(c["href"]), E(c["text"])))
        else:
            parts.append("<span>%s</span>" % E(c["text"]))
    out.append('      <p class="contact">%s</p>' % ' <span class="sep">|</span> '.join(parts))
    out.append("    </div>")
    return out


def summary_block(text):
    return ['    <section aria-labelledby="h-summary">', '      <h2 id="h-summary">Summary</h2>', '      <p class="summary">%s</p>' % E(text), "    </section>"]


def reads_nav(current):
    links = [("General", "/resume-pdf.html", "canonical")] + [(b["label"], "/resume/%s.html" % b["id"], b["id"]) for b in BUILDS]
    out = []
    for label, href, key in links:
        cur = ' aria-current="page"' if key == current else ""
        out.append('<a href="%s"%s>%s</a>' % (href, cur, E(label)))
    return " ".join(out)


def render(page):
    t = template
    block = re.compile(r"\{\{#canonical\}\}\n?(.*?)\{\{/canonical\}\}\n?", re.S)
    t = block.sub(lambda m: m.group(1) if page["canonical_head"] else "", t)
    for k, v in page["vars"].items():
        t = t.replace("{{%s}}" % k, v)
    left = re.findall(r"\{\{[^}]*\}\}", t)
    if left:
        fail("unfilled template keys in %s: %s" % (page["path"], left))
    return t


def jsonld(graph):
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def page_vars(*, title, description, canonical, stem, pdf_dir, build_id, body, graph, current):
    v = R["v"]
    pdf = "/%s%s.pdf?v=%s" % (pdf_dir, stem, v)
    txt = "/%s%s.txt?v=%s" % (pdf_dir, stem, v)
    return {
        "title": E(title),
        "description": E(description),
        "canonical": E(canonical),
        "pdf": E(pdf),
        "txt": E(txt),
        "pdf_title": E(title + " (PDF)"),
        "txt_title": E(title + " (plain text)"),
        "v": E(v),
        "jsonld": jsonld(graph),
        "build": E(build_id),
        "file": E(stem),
        "reads": reads_nav(current),
        "body": "\n".join(body),
    }


def canonical_page():
    graph = [n for n in schema.get("@graph", []) if str(n.get("@id", "")).startswith(BASE + "/resume-pdf.html")]
    if not graph:
        fail("schema.json has no resume-pdf.html nodes")
    c = R["canonical"]
    body = head_block(None) + summary_block(rec["summary"]) + experience(c["proofs"]) + education() + certificates("canonical") + skills("canonical", c["skills"])
    return {
        "path": ROOT / "resume-pdf.html",
        "canonical_head": True,
        "vars": page_vars(
            title="Jason Obawemimo Resume | " + R["title"],
            description="Resume for Jason Obawemimo, Pearland, Texas: AI implementation, workflow automation and CRM systems. Owner and Operations Lead of Triple J Auto Investment in Houston, shipping the CRM, voice AI and automation systems that run the dealership.",
            canonical=BASE + "/resume-pdf.html",
            stem=CANON_STEM,
            pdf_dir="assets/",
            build_id="",
            body=body,
            graph=graph,
            current="canonical",
        ),
    }


def build_page(b):
    url = "%s/resume/%s.html" % (BASE, b["id"])
    title = "Jason Obawemimo Resume | " + b["label"]
    kws = b["keywords"]
    desc = "Resume for Jason Obawemimo, read for %s roles: %s. Owner and Operations Lead of Triple J Auto Investment in Houston." % (b["label"], ", ".join(kws[:9]))
    graph = [
        {
            "@type": "WebPage",
            "@id": url + "#webpage",
            "url": url,
            "name": title,
            "description": desc,
            "isPartOf": {"@id": BASE + "/#website"},
            "about": {"@id": BASE + "/#jason-obawemimo"},
            "mainEntity": {"@id": BASE + "/#jason-obawemimo"},
            "breadcrumb": {"@id": url + "#breadcrumbs"},
        },
        {
            "@type": "BreadcrumbList",
            "@id": url + "#breadcrumbs",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Jason Obawemimo", "item": BASE + "/"},
                {"@type": "ListItem", "position": 2, "name": "Resume", "item": BASE + "/resume-pdf.html"},
                {"@type": "ListItem", "position": 3, "name": b["label"], "item": url},
            ],
        },
    ]
    body = head_block(b) + summary_block(b["summary"]) + experience(b["proofs"]) + education() + certificates(b["id"]) + skills(b["id"], b["skills"])
    return {
        "path": ROOT / "resume" / ("%s.html" % b["id"]),
        "canonical_head": False,
        "vars": page_vars(
            title=title,
            description=desc,
            canonical=url,
            stem=file_stem(b["label"]),
            pdf_dir="assets/resume/",
            build_id=b["id"],
            body=body,
            graph=graph,
            current=b["id"],
        ),
    }


def visible_text(doc):
    doc = re.sub(r"<script\b.*?</script>", " ", doc, flags=re.S)
    doc = re.sub(r"<style\b.*?</style>", " ", doc, flags=re.S)
    desc = " ".join(re.findall(r'<meta name="description" content="([^"]*)"', doc))
    body = doc.split("<body", 1)[-1]
    body = re.sub(r"<!--.*?-->", " ", body, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", body)
    title = " ".join(re.findall(r"<title>(.*?)</title>", doc))
    return html.unescape(" ".join([title, desc, text]))


PHONE = re.compile(r"(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b")


def check(path, doc):
    text = visible_text(doc)
    for ch, name in (("—", "an em dash"), ("–", "an en dash"), ("%", "a percent sign")):
        if ch in text:
            fail("%s has %s" % (path, name))
    if "—" in doc or "–" in doc:
        fail("%s has a dash in its source" % path)
    if PHONE.search(text):
        fail("%s has something shaped like a phone number" % path)
    for n in numbers(text):
        if n not in LLMS_NUMBERS:
            fail("%s prints %s, which is not in llms.txt" % (path, n))


def check_record():
    flat = re.sub(r"\s+", " ", llms)
    if rec["summary"] not in flat:
        fail("record.json summary is not in llms.txt")
    for b in BUILDS:
        for k in ("headline", "summary"):
            if b[k] not in flat:
                fail("build %s %s is not in llms.txt" % (b["id"], k))
    for f in lexicon.get("facts", {}).values():
        for n in numbers(f["answer"]):
            if n not in LLMS_NUMBERS:
                fail("lexicon fact answer prints %s, not in llms.txt" % n)
    ids = set(PROOFS)
    for key, t in lexicon["terms"].items():
        for p in t.get("proofs", []):
            if p not in ids:
                fail("lexicon term %s names unknown proof %s" % (key, p))
        if not t.get("off") and not t.get("ignore") and not t.get("proofs"):
            fail("lexicon term %s is on the record but names no proof" % key)


def write_match_data():
    data = {
        "v": R["v"],
        "builds": [{"id": b["id"], "label": b["label"], "proofs": b["proofs"]} for b in BUILDS],
        "terms": lexicon["terms"],
        "facts": lexicon["facts"],
    }
    path = ROOT / "match.js"
    src = path.read_text()
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    new, n = re.subn(r"/\*@data\*/.*?/\*@end\*/", lambda m: "/*@data*/" + blob + "/*@end*/", src, count=1, flags=re.S)
    if n != 1:
        fail("match.js has no /*@data*/ block")
        return
    path.write_text(new)


def main():
    check_record()
    pages = [canonical_page()] + [build_page(b) for b in BUILDS]
    out = []
    for p in pages:
        doc = render(p)
        check(p["path"].relative_to(ROOT), doc)
        out.append((p["path"], doc))
    if problems:
        print("build_resume: refusing to write.", file=sys.stderr)
        for m in problems:
            print("  " + m, file=sys.stderr)
        sys.exit(1)
    (ROOT / "resume").mkdir(exist_ok=True)
    for path, doc in out:
        path.write_text(doc)
        print("wrote", path.relative_to(ROOT))
    write_match_data()
    if problems:
        for m in problems:
            print("  " + m, file=sys.stderr)
        sys.exit(1)
    print("wrote match.js data (%d terms)" % len(lexicon["terms"]))


if __name__ == "__main__":
    main()
