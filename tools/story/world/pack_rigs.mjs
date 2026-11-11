// After Hours: compress the night's rigs (tools/story/world/rigs.py) with gltfpack (meshoptimizer, MIT):
// quantized attributes, meshopt compression, nodes and materials kept, nothing simplified (the phone
// model is built lighter, not decimated: decimation eats flat panels and lettering).
//   node tools/story/world/pack_rigs.mjs <dir of raw glbs> [v]
// Writes assets/story/world/rig-<name>-<v>.glb and rig-<name>-lo-<v>.glb.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const [src, v = 'v1'] = process.argv.slice(2);
const out = path.join(ROOT, 'assets', 'story', 'world');
const gp = process.env.GLTFPACK || path.join(HERE, '..', 'node_modules', '.bin', 'gltfpack');
for (const f of fs.readdirSync(src).filter(f => /^(engine|ambulance)(-lo)?\.glb$/.test(f))) {
  const name = f.replace(/\.glb$/, '');
  const dst = path.join(out, `rig-${name.replace(/-lo$/, '')}${name.endsWith('-lo') ? '-lo' : ''}-${v}.glb`);
  execFileSync(gp, ['-i', path.join(src, f), '-o', dst, '-cc', '-kn', '-km', '-vp', '14', '-vn', '10', '-vc', '8'], { stdio: 'inherit' });
  console.log('pack:', name, (fs.statSync(path.join(src, f)).size / 1024).toFixed(0), 'KB ->', (fs.statSync(dst).size / 1024).toFixed(0), 'KB');
}
