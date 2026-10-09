// The walkthrough's narration, voiced by ElevenLabs.
//
//   ELEVENLABS_API_KEY=... node tools/voice/eleven.mjs [lines.json] [--force] [--only id,id]
//
// Reads tools/voice/tour_lines.json (or the file given), and for every line calls
// the text-to-speech "with-timestamps" endpoint, then writes
//   assets/voice/tour/<id>.mp3    the line, mp3 44.1 kHz 128 kbps
//   assets/voice/tour/<id>.json   { id, text, duration, words: [{ w, s, e }] } in seconds,
//                                 built from the character alignment, so captions
//                                 light word by word on the real voice
//   assets/voice/tour/manifest.json  every voiced line, its hash, the voice and model
// A line whose text, voice, model and settings are unchanged since the last run is
// skipped (its hash is in the manifest), so editing one line re-voices one line.
//
// Without ELEVENLABS_API_KEY it writes nothing and exits 0 with a message: the
// film and the tour then stay in their caption-only mode, which is labelled as
// such and never presented as voiced. Nothing here fakes or mocks speech.
//
// The voice: a premium stock narrator from the ElevenLabs voice library, never a
// clone. Default "Brian" (nPczCjzI2devNBz1zQrb): an American male narrator, deep,
// calm and assured, made for long-form narration. Override with
// ELEVENLABS_VOICE_ID (for example "George", JBFqnCBsd6RMkjVDRZzb, a warm British
// narrator). ELEVENLABS_MODEL overrides the model (default eleven_multilingual_v2,
// the most stable model that returns character timings).
//
// After this, sh tools/voice/narrate.sh does the rest (film render with the voice,
// captions from these timings, the site's tour data); it calls this script first.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'assets', 'voice', 'tour');
const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? new Set((args[onlyAt + 1] || '').split(',').filter(Boolean)) : null;
const linesFile = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--only') || path.join(HERE, 'tour_lines.json');

const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID || 'nPczCjzI2devNBz1zQrb';
const VOICE_NAME = process.env.ELEVENLABS_VOICE_NAME || (VOICE === 'nPczCjzI2devNBz1zQrb' ? 'Brian' : VOICE);
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const FORMAT = 'mp3_44100_128';
// calm and even, a narrator rather than an announcer: high stability, no added style
const SETTINGS = { stability: 0.62, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true, speed: 0.96 };

if (!KEY) {
  console.log('eleven: ELEVENLABS_API_KEY is not set, so nothing was voiced.');
  console.log('eleven: the film and the tour stay caption-only (timed by an estimate) until it is.');
  console.log('eleven: set it and run  sh tools/voice/narrate.sh');
  process.exit(0);
}

const doc = JSON.parse(fs.readFileSync(linesFile, 'utf8'));
const lines = doc.lines.filter(l => !only || only.has(l.id));
fs.mkdirSync(OUT, { recursive: true });
const manPath = path.join(OUT, 'manifest.json');
let man = { lines: {} };
try { man = JSON.parse(fs.readFileSync(manPath, 'utf8')); man.lines = man.lines || {}; } catch {}

const hashOf = l => crypto.createHash('sha1').update(JSON.stringify([l.text, VOICE, MODEL, SETTINGS])).digest('hex').slice(0, 12);

// Characters to words: a word runs from its first character's start to its last
// character's end. Spaces end a word; punctuation stays with the word it follows.
function words(al) {
  const out = []; let cur = null;
  for (let i = 0; i < al.characters.length; i++) {
    const c = al.characters[i], s = al.character_start_times_seconds[i], e = al.character_end_times_seconds[i];
    if (/\s/.test(c)) { if (cur) { out.push(cur); cur = null; } continue; }
    if (!cur) cur = { w: '', s, e };
    cur.w += c; cur.e = e;
  }
  if (cur) out.push(cur);
  return out.map(x => ({ w: x.w, s: +x.s.toFixed(3), e: +x.e.toFixed(3) }));
}

async function speak(line, prev, next) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=${FORMAT}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      // the neighbouring lines keep the read continuous from shot to shot
      body: JSON.stringify({ text: line.text, model_id: MODEL, voice_settings: SETTINGS, previous_text: prev || undefined, next_text: next || undefined }),
    });
    if (r.ok) return r.json();
    const body = (await r.text()).slice(0, 400);
    if (r.status === 401 || r.status === 403) throw new Error(`ElevenLabs refused the key (${r.status}): ${body}`);
    if (attempt === 3 || !(r.status === 429 || r.status >= 500)) throw new Error(`ElevenLabs ${r.status} on "${line.id}": ${body}`);
    await new Promise(res => setTimeout(res, 1500 * attempt));
  }
}

let voiced = 0, kept = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i], h = hashOf(l);
  const mp3 = path.join(OUT, `${l.id}.mp3`), js = path.join(OUT, `${l.id}.json`);
  if (!force && man.lines[l.id] && man.lines[l.id].hash === h && fs.existsSync(mp3) && fs.existsSync(js)) { kept++; continue; }
  const all = doc.lines, at = all.findIndex(x => x.id === l.id);
  const res = await speak(l, all[at - 1] && all[at - 1].text, all[at + 1] && all[at + 1].text);
  const al = res.alignment || res.normalized_alignment;
  if (!res.audio_base64 || !al) throw new Error(`no audio or alignment for "${l.id}"`);
  fs.writeFileSync(mp3, Buffer.from(res.audio_base64, 'base64'));
  const w = words(al);
  const duration = +(al.character_end_times_seconds[al.character_end_times_seconds.length - 1] || 0).toFixed(3);
  fs.writeFileSync(js, JSON.stringify({ id: l.id, text: l.text, duration, words: w }, null, 1) + '\n');
  man.lines[l.id] = { hash: h, duration, file: `${l.id}.mp3`, timings: `${l.id}.json` };
  voiced++;
  console.log(`eleven: ${l.id}  ${duration.toFixed(2)} s  ${w.length} words`);
}
// lines removed from the script leave the manifest (their files stay until deleted by hand)
const ids = new Set(doc.lines.map(l => l.id));
for (const id of Object.keys(man.lines)) if (!ids.has(id)) delete man.lines[id];
man.voice = { id: VOICE, name: VOICE_NAME, model: MODEL, format: FORMAT, settings: SETTINGS, source: 'ElevenLabs stock voice library (not a clone)' };
man.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(manPath, JSON.stringify(man, null, 1) + '\n');
console.log(`eleven: ${voiced} voiced, ${kept} unchanged, manifest at ${path.relative(ROOT, manPath)}`);
