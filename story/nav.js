/* After Hours: where you can walk. A grid over the set's floor, built once per
   set from the walls (every parked car, lamp pole, desk, shelf and fence is a
   box in set.userData.walls) and the room's bounds, then A* with a string pull
   so a tap across the lot walks around the cars in long straight lines, the
   way a person would, not along the grid.

   buildNav(set) -> { path(ax, az, bx, bz) -> [{x, z}, ...] | null,
                      free(x, z), near(x, z) -> {x, z} | null, clear(ax, az, bx, bz),
                      cell, w, h, x0, z0 }
   The world may hand over its own walkable area as set.userData.nav
   ({ x0, x1, z0, z1, cell, blocked: [{x0, x1, z0, z1}] }); it is used when there. */

const R = 0.34; // a person's half width plus a little room

export function buildNav(set) {
  if (set.userData._nav) return set.userData._nav;
  const ud = set.userData, given = ud.nav || {};
  const walls = (ud.walls || []).concat(given.blocked || []);
  let x0, x1, z0, z1;
  if (given.x0 != null) ({ x0, x1, z0, z1 } = given);
  else if (ud.bounds) ({ x0, x1, z0, z1 } = ud.bounds);
  else {
    // outside: the lot's ground, a little past the gate where you arrive
    x0 = -34.4; x1 = 34.4; z0 = -26.4; z1 = 27.5;
  }
  const cell = given.cell || (x1 - x0 > 30 ? 0.4 : 0.2);
  const w = Math.ceil((x1 - x0) / cell), h = Math.ceil((z1 - z0) / cell);
  const grid = new Uint8Array(w * h); // 1 = blocked
  for (const b of walls) {
    const i0 = Math.max(0, Math.floor((b.x0 - R - x0) / cell)), i1 = Math.min(w - 1, Math.floor((b.x1 + R - x0) / cell));
    const j0 = Math.max(0, Math.floor((b.z0 - R - z0) / cell)), j1 = Math.min(h - 1, Math.floor((b.z1 + R - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = x0 + (i + 0.5) * cell, cz = z0 + (j + 0.5) * cell;
      if (cx > b.x0 - R && cx < b.x1 + R && cz > b.z0 - R && cz < b.z1 + R) grid[j * w + i] = 1;
    }
  }
  // the edge of a room is a wall too
  if (ud.bounds) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const cx = x0 + (i + 0.5) * cell, cz = z0 + (j + 0.5) * cell;
    if (cx < ud.bounds.x0 + 0.05 || cx > ud.bounds.x1 - 0.05 || cz < ud.bounds.z0 + 0.05 || cz > ud.bounds.z1 - 0.05) grid[j * w + i] = 1;
  }
  const ci = x => Math.floor((x - x0) / cell), cj = z => Math.floor((z - z0) / cell);
  const inGrid = (i, j) => i >= 0 && j >= 0 && i < w && j < h;
  const freeIJ = (i, j) => inGrid(i, j) && !grid[j * w + i];
  const free = (x, z) => freeIJ(ci(x), cj(z));
  function nearIJ(i, j, maxR = 40) {
    if (freeIJ(i, j)) return [i, j];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (freeIJ(i + di, j + dj)) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = [i + di, j + dj]; } }
      }
      if (best) return best;
    }
    return null;
  }
  const near = (x, z) => { const n = nearIJ(ci(x), cj(z)); return n ? { x: x0 + (n[0] + 0.5) * cell, z: z0 + (n[1] + 0.5) * cell } : null; };
  // a straight walk from a to b that never touches a blocked cell
  function clear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / (cell * 0.5)));
    for (let k = 0; k <= n; k++) { const t = k / n; if (!free(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  // A*, eight ways, no cutting corners
  const g = new Float32Array(w * h), from = new Int32Array(w * h), seen = new Uint32Array(w * h);
  let stamp = 0;
  function path(ax, az, bx, bz) {
    const s = nearIJ(ci(ax), cj(az), 6), e = nearIJ(ci(bx), cj(bz));
    if (!s || !e) return null;
    const goal = { x: x0 + (e[0] + 0.5) * cell, z: z0 + (e[1] + 0.5) * cell };
    // the exact end when it is walkable, else the nearest place that is
    const end = free(bx, bz) ? { x: bx, z: bz } : goal;
    if (clear(ax, az, end.x, end.z)) return [{ x: ax, z: az }, end];
    stamp++;
    const si = s[1] * w + s[0], ei = e[1] * w + e[0];
    const heap = [], hf = [];
    const push = (i, f) => { heap.push(i); hf.push(f); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; [hf[p], hf[k]] = [hf[k], hf[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = last; hf[0] = lf; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; [hf[m], hf[k]] = [hf[k], hf[m]]; k = m; } } return top; };
    const hx = e[0], hz = e[1];
    const H = i => { const dx = Math.abs((i % w) - hx), dz = Math.abs(((i / w) | 0) - hz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    g[si] = 0; from[si] = -1; seen[si] = stamp; push(si, H(si));
    const closed = new Uint8Array(w * h);
    let found = false, it = 0;
    while (heap.length && it++ < 60000) {
      const c = pop(); if (closed[c]) continue; closed[c] = 1;
      if (c === ei) { found = true; break; }
      const cx = c % w, cz = (c / w) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz; if (!freeIJ(nx, nz)) continue;
        if (dx && dz && (!freeIJ(cx + dx, cz) || !freeIJ(cx, cz + dz))) continue;
        const n = nz * w + nx; if (closed[n]) continue;
        const ng = g[c] + (dx && dz ? Math.SQRT2 : 1);
        if (seen[n] !== stamp || ng < g[n]) { seen[n] = stamp; g[n] = ng; from[n] = c; push(n, ng + H(n)); }
      }
    }
    if (!found) return null;
    const raw = [];
    for (let c = ei; c !== -1; c = from[c]) raw.push({ x: x0 + ((c % w) + 0.5) * cell, z: z0 + (((c / w) | 0) + 0.5) * cell });
    raw.reverse(); raw[0] = { x: ax, z: az }; raw[raw.length - 1] = end;
    // string pull: keep only the corners you can't see past
    const out = [raw[0]];
    let k = 0;
    while (k < raw.length - 1) {
      let j = raw.length - 1;
      while (j > k + 1 && !clear(raw[k].x, raw[k].z, raw[j].x, raw[j].z)) j--;
      out.push(raw[j]); k = j;
    }
    return out;
  }
  const nav = { path, free, near, clear, cell, w, h, x0, z0, grid };
  ud._nav = nav;
  return nav;
}

/* the length of a path, and the point a distance along it */
export function pathLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); return L; }
export function pathAt(p, d) {
  for (let i = 1; i < p.length; i++) {
    const s = Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
    if (d <= s || i === p.length - 1) { const t = s ? Math.min(1, d / s) : 0; return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * t, z: p[i - 1].z + (p[i].z - p[i - 1].z) * t, dx: (p[i].x - p[i - 1].x) / (s || 1), dz: (p[i].z - p[i - 1].z) / (s || 1) }; }
    d -= s;
  }
  return p.length ? { x: p[p.length - 1].x, z: p[p.length - 1].z, dx: 0, dz: 1 } : null;
}
