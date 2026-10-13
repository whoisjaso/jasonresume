// After Hours: compress the lot's cars (tools/story/world/cars.py) with gltfpack (meshoptimizer, MIT):
// quantized attributes, meshopt compression, nodes, materials and extras kept, simplified to a budget
// (the phone tier aggressively: v2 cars carry a cabin and moving parts, and the phone budget stays near v1's).
//   node tools/story/world/pack.mjs <dir of raw glbs> [v]
// Writes assets/story/world/car-<kind>-<v>.glb (the near model) and car-<kind>-lo-<v>.glb (phones and far rows).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const [src, v = 'v1'] = process.argv.slice(2);
const out = path.join(ROOT, 'assets', 'story', 'world');
fs.mkdirSync(out, { recursive: true });
const gp = path.join(HERE, '..', 'node_modules', '.bin', 'gltfpack');
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.glb') && !f.startsWith('p-'))) {
  const name = f.replace(/\.glb$/, '');
  for (const [tag, si] of [['', '0.5'], ['-lo', '0.16']]) {
    const dst = path.join(out, `car-${name}${tag}-${v}.glb`);
    execFileSync(gp, ['-i', path.join(src, f), '-o', dst, '-cc', '-kn', '-km', '-ke', '-vp', '12', '-vc', '8', '-si', si].concat(tag ? ['-sa'] : []), { stdio: 'inherit' });
    console.log('pack:', name + tag, (fs.statSync(path.join(src, f)).size / 1024).toFixed(0), 'KB ->', (fs.statSync(dst).size / 1024).toFixed(0), 'KB');
  }
}
