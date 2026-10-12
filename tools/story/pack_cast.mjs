// After Hours: compress the cast. Each GLB from mh_cast.py goes through gltfpack
// (meshoptimizer, MIT): quantized attributes, meshopt compression, textures kept
// as the WebP Blender wrote. Writes assets/story/cast/<name>-<v>.glb.
//   node tools/story/pack_cast.mjs <dir of raw glbs> [v]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const [src, v = 'v1'] = process.argv.slice(2);
const out = path.join(ROOT, 'assets', 'story', 'cast');
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.glb'))) {
  const name = f.replace(/\.glb$/, '');
  const dst = path.join(out, `${name}-${v}.glb`);
  execFileSync(path.join(HERE, 'node_modules', '.bin', 'gltfpack'), ['-i', path.join(src, f), '-o', dst, '-cc', '-kn', '-km', '-vp', '14', '-vt', '12'], { stdio: 'inherit' });
  console.log('pack:', name, (fs.statSync(path.join(src, f)).size / 1024).toFixed(0), 'KB ->', (fs.statSync(dst).size / 1024).toFixed(0), 'KB');
}
