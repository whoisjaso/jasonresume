/*
  The listing match. window.JG_MATCH.read(text) reads a pasted job listing entirely in the browser and returns
    { build, builds: [{ id, hits }], on: [{ term, as, proofs }], off: [{ term, as }], facts: [{ topic, as, answer }] }
  on: terms on Jason's verified record, each with the builds.json proofs that verify it.
  off: known terms the listing asks for that are not on the record. Named, never claimed.
  as: the listing's own spelling. Both lists are deduplicated and in listing order.
  build: the reading with the most hits (on terms its proofs verify); a tie goes to the earlier build in builds.json.
  facts: degree and years-of-experience requirements, answered with text already in llms.txt, never with a verdict.
  It never computes a percentage or a fit score, and nothing from the listing leaves the page.
  The data block below is written by tools/site/build_resume.py from tools/site/lexicon.json and
  tools/site/builds.json. Edit those and run the script, not the block.
*/
(function () {
  "use strict";

  var DATA = /*@data*/{"v":"","builds":[],"terms":{},"facts":{}}/*@end*/;

  var MAX = 60000;
  var compiled = null;
  var byKey = null;

  function escRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function wordChar(c) {
    return /[A-Za-z0-9]/.test(c);
  }

  // One alias to a regex. Hyphens and spaces are interchangeable, a trailing s or es is allowed,
  // and an alias that starts or ends on a letter or digit must sit on a word boundary.
  function aliasRe(alias, caseSensitive, plural) {
    if (alias.indexOf("re:") === 0) {
      return { re: new RegExp(alias.slice(3), "g"), raw: true };
    }
    var cs = caseSensitive;
    if (alias.charAt(0) === "=") {
      cs = true;
      alias = alias.slice(1);
    }
    var body = alias.split(/[\s-]+/).filter(Boolean).map(escRe).join("[\\s\\-]*");
    var first = alias.charAt(0);
    var last = alias.charAt(alias.length - 1);
    var tail = plural && /[A-Za-z]/.test(last) ? "(?:e?s)?" : "";
    var pre = wordChar(first) ? "(^|[^A-Za-z0-9])" : "()";
    var post = wordChar(last) || last === "+" || last === "#" ? "(?![A-Za-z0-9])" : "";
    return { re: new RegExp(pre + "(" + body + tail + ")" + post, cs ? "g" : "gi"), raw: false };
  }

  function compile() {
    if (compiled) return compiled;
    compiled = [];
    byKey = {};
    Object.keys(DATA.terms).forEach(function (key) {
      var t = DATA.terms[key];
      var kind = t.ignore ? "ignore" : t.off ? "off" : "on";
      var plural = t.plural !== false;
      var aliases = (t.aliases || []).slice();
      var csKey = aliases.indexOf("=" + key) !== -1;
      if (t.key !== false && !csKey) aliases.unshift(key);
      var res = aliases.map(function (a) { return aliasRe(a, !!t.case, plural); });
      var nots = (t.not || []).map(function (n) { return new RegExp(n, "gi"); });
      var entry = { key: key, kind: kind, proofs: t.proofs || [], res: res, nots: nots };
      compiled.push(entry);
      byKey[key.toLowerCase()] = entry;
    });
    return compiled;
  }

  // Curly quotes, odd spaces and dashes to plain ones, one character for one, so indexes still point into the original.
  function plain(text) {
    return text
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[   ]/g, " ")
      .replace(/[‐-―−]/g, "-");
  }

  function spans(entry, text) {
    var out = [];
    var blocked = [];
    entry.nots.forEach(function (re) {
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(text))) {
        blocked.push([m.index, m.index + m[0].length]);
        if (!m[0].length) re.lastIndex++;
      }
    });
    entry.res.forEach(function (r) {
      var re = r.re;
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(text))) {
        var start;
        var end;
        if (r.raw) {
          var hit = m[1] !== undefined ? m[1] : m[0];
          start = m.index + (m[1] !== undefined ? m[0].indexOf(m[1]) : 0);
          end = start + hit.length;
        } else {
          start = m.index + m[1].length;
          end = start + m[2].length;
        }
        if (!m[0].length) re.lastIndex++;
        if (end <= start) continue;
        var inBlock = blocked.some(function (b) { return start >= b[0] && end <= b[1]; });
        if (!inBlock) out.push({ start: start, end: end, entry: entry });
      }
    });
    return out;
  }

  function overlap(a, b) {
    return a.proofs.some(function (p) { return b.indexOf(p) !== -1; });
  }

  function read(text) {
    var src = typeof text === "string" ? text.slice(0, MAX) : "";
    var norm = plain(src);
    var all = [];
    compile().forEach(function (entry) {
      Array.prototype.push.apply(all, spans(entry, norm));
    });
    // Longest phrase first, then earliest; a shorter term inside a taken phrase does not count.
    all.sort(function (a, b) {
      return (b.end - b.start) - (a.end - a.start) || a.start - b.start;
    });
    var taken = new Uint8Array(norm.length + 1);
    var kept = [];
    all.forEach(function (s) {
      for (var i = s.start; i < s.end; i++) if (taken[i]) return;
      for (var j = s.start; j < s.end; j++) taken[j] = 1;
      kept.push(s);
    });
    kept.sort(function (a, b) { return a.start - b.start; });
    var on = [];
    var off = [];
    var seen = {};
    kept.forEach(function (s) {
      var e = s.entry;
      if (e.kind === "ignore" || seen[e.key]) return;
      seen[e.key] = true;
      var as = src.slice(s.start, s.end).replace(/\s+/g, " ").trim();
      if (e.kind === "on") on.push({ term: e.key, as: as, proofs: e.proofs.slice() });
      else off.push({ term: e.key, as: as });
    });
    var builds = DATA.builds.map(function (b) {
      return { id: b.id, hits: on.filter(function (o) { return overlap(o, b.proofs); }).length };
    });
    var best = null;
    builds.forEach(function (b) {
      if (!best || b.hits > best.hits) best = b;
    });
    var facts = [];
    Object.keys(DATA.facts).forEach(function (topic) {
      var f = DATA.facts[topic];
      var re = new RegExp(f.detect, "i");
      var m = re.exec(norm);
      if (m) facts.push({ topic: topic, as: src.slice(m.index, m.index + m[0].length).replace(/\s+/g, " ").trim(), answer: f.answer, at: m.index });
    });
    facts.sort(function (a, b) { return a.at - b.at; });
    facts.forEach(function (f) { delete f.at; });
    return { build: best ? best.id : null, builds: builds, on: on, off: off, facts: facts };
  }

  // A canonical term by name: { term, proofs, off }, or null.
  function term(name) {
    compile();
    var e = byKey[String(name || "").toLowerCase()];
    if (!e || e.kind === "ignore") return null;
    return { term: e.key, proofs: e.proofs.slice(), off: e.kind === "off" };
  }

  // True when s is, in full, one of the spellings of the canonical term name.
  function spells(name, s) {
    compile();
    var e = byKey[String(name || "").toLowerCase()];
    var str = plain(String(s || "")).replace(/\s+/g, " ").trim();
    if (!e || !str) return false;
    return spans(e, str).some(function (sp) { return sp.start === 0 && sp.end === str.length; });
  }

  // The hash a build page reads to print a listing-tailored resume: #t=Term:spelling,Term
  function hash(result) {
    var on = (result && result.on) || [];
    return "#t=" + on.map(function (o) {
      var t = encodeURIComponent(o.term);
      return o.as && o.as !== o.term ? t + ":" + encodeURIComponent(o.as) : t;
    }).join(",");
  }

  var api = { read: read, term: term, spells: spells, hash: hash, version: DATA.v };
  if (typeof window !== "undefined") window.JG_MATCH = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
