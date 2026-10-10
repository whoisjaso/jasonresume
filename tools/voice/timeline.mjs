// The walkthrough's timeline: the lines, and when each word is said.
//
//   node tools/voice/timeline.mjs
//
// Reads tools/voice/tour_lines.json and, where tools/voice/narrate_free.py (or eleven.mjs) has voiced
// a line, assets/voice/tour/<id>.json (real word timings from the voice model).
// Writes
//   tools/film/src/tour/timeline.json   the film's shots, frames and captions
//   tools/site/tour.json                the site's tour: steps, lines, word timings,
//                                       audio paths (assemble_home.py inlines it)
//
// CAPTION-ONLY MODE: a line with no recording gets word timings from an ESTIMATE
// (a calm narrator's pace from each word's length, with pauses at commas and full
// stops). Those timings only pace the captions; they are marked "voiced": false
// everywhere, and nothing that reads them may present the line as spoken.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const doc = JSON.parse(fs.readFileSync(path.join(HERE, 'tour_lines.json'), 'utf8'));
const VOICE = path.join(ROOT, 'assets', 'voice', 'tour');
let man = { lines: {} };
try { man = JSON.parse(fs.readFileSync(path.join(VOICE, 'manifest.json'), 'utf8')); } catch {}

/* ESTIMATE, for caption-only mode: about 150 words a minute */
export function estimate(text) {
  let t = 0; const words = [];
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const letters = w.replace(/[^\p{L}\p{N}$]/gu, '').length;
    const d = 0.12 + 0.046 * Math.max(2, letters) + (/\d/.test(w) ? 0.22 : 0);
    words.push({ w, s: +t.toFixed(3), e: +(t + d * 0.86).toFixed(3) });
    t += d + (/[.:?!]$/.test(w) ? 0.36 : /[,;]$/.test(w) ? 0.16 : 0);
  }
  return { duration: +(words.length ? words[words.length - 1].e : 0).toFixed(3), words };
}

function timing(line) {
  const m = man.lines && man.lines[line.id];
  const f = path.join(VOICE, `${line.id}.json`);
  if (m && fs.existsSync(f) && fs.existsSync(path.join(VOICE, `${line.id}.mp3`))) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (j.text === line.text) return { voiced: true, duration: j.duration, words: j.words, audio: `assets/voice/tour/${line.id}.mp3` };
    console.warn(`timeline: "${line.id}" changed since it was voiced; run tools/voice/narrate_free.py. Using the estimate.`);
  }
  return { voiced: false, ...estimate(line.text) };
}

const byId = Object.fromEntries(doc.lines.map(l => [l.id, { id: l.id, text: l.text, ...timing(l) }]));
const voicedAll = doc.lines.every(l => byId[l.id].voiced);

// the film (After Hours): a beat is a line, an act card, or both. Each holds its
// silence before (pre) and after (post) the words, because the holds are part
// of it; a recording's own lead-in silence is trimmed so speech starts exactly
// pre seconds in. The film runs at 32 fps so the score's 64 BPM is a whole 30
// frames a beat (120 a bar): every beat is rounded up to an eighth (15 frames),
// so every cut, card and line starts on the score's grid.
const FPS = 32, BEAT = 30, GRID = 15;
let at = 0;
const shots = doc.film.map(s => {
  const L = s.line ? byId[s.line] : null;
  const w0 = L && L.words.length ? L.words[0].s : 0, w1 = L && L.words.length ? L.words[L.words.length - 1].e : (L ? L.duration : 0);
  const pre = s.pre || 0, post = s.post || 0;
  const secs = L ? pre + (w1 - w0) + post : (s.hold || 3);
  const frames = Math.ceil((secs * FPS) / GRID) * GRID;
  const shot = { shot: s.shot, card: s.card || null, line: s.line || null, text: L ? L.text : '', from: at, frames,
    speakAt: L ? at + Math.round(pre * FPS) : null, speechFrom: L ? at + Math.round((pre - w0) * FPS) : null,
    voiced: L ? L.voiced : false, audio: L && L.voiced ? L.audio : null, words: L ? L.words : [] };
  at += frames;
  return shot;
});
const film = { fps: FPS, beat: BEAT, frames: at, seconds: +(at / FPS).toFixed(2), voiced: doc.film.every(s => !s.line || byId[s.line].voiced), shots };
fs.mkdirSync(path.join(ROOT, 'tools', 'film', 'src', 'tour'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools', 'film', 'src', 'tour', 'timeline.json'), JSON.stringify(film, null, 1) + '\n');

const site = {
  voiced: voicedAll,
  label: voicedAll ? doc.voice.label : doc.voice.caption_only,
  narration: doc.voice.label,
  lines: Object.fromEntries(Object.values(byId).map(l => [l.id, { text: l.text, voiced: l.voiced, audio: l.voiced ? l.audio : null, duration: l.duration, words: l.words.map(w => [w.s, w.e]) }])),
  steps: doc.tour,
};
fs.writeFileSync(path.join(ROOT, 'tools', 'site', 'tour.json'), JSON.stringify(site) + '\n');
console.log(`timeline: film ${film.seconds} s over ${shots.length} shots, ${film.voiced ? 'voiced' : 'caption-only (estimated timing)'}; tour ${doc.tour.length} steps`);
