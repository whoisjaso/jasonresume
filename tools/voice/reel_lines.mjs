// Lists the trailer's spoken lines for the voice clone.
// Reads every `vo: "..."` in reel.js, keys it the way reel.js does (FNV-1a of
// the text, prefixed "r"), and writes tools/voice/reel_lines.json, skipping
// lines already rendered in assets/voice/manifest.json unless --all.
//   node tools/voice/reel_lines.mjs [--all]
//   LINES=reel_lines.json python3 tools/voice/render_clone.py
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const src = fs.readFileSync(path.join(REPO, 'reel.js'), 'utf8');
const vid = t => { let h = 0x811c9dc5; for (let k = 0; k < t.length; k++) { h ^= t.charCodeAt(k); h = Math.imul(h, 16777619); } return 'r' + (h >>> 0).toString(16); };
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'assets/voice/manifest.json'), 'utf8'));
const all = process.argv.includes('--all');
const seen = new Set(), lines = [];
for (const m of src.matchAll(/vo: "((?:[^"\\]|\\.)*)"/g)) {
  const text = JSON.parse('"' + m[1] + '"'), id = vid(text);
  if (seen.has(id) || (!all && manifest[id])) continue;
  seen.add(id); lines.push({ id, face: 'warm', text });
}
fs.writeFileSync(path.join(HERE, 'reel_lines.json'), JSON.stringify(lines, null, 1) + '\n');
console.log(`${lines.length} line(s) to render -> tools/voice/reel_lines.json`);
