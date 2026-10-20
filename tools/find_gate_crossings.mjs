// 找出道路与校园边界的交点（校门候选），输出本地坐标与最近地点
import fs from 'node:fs';

const s = fs.readFileSync('C:/Users/86134/Desktop/gdufs/gdufs-3d/gdufs-data.js', 'utf8');
const D = JSON.parse(s.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

function segIntersect(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const q = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * q[1] - r[1] * q[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

const hits = [];
D.roads.forEach((rd) => {
  rd.lines.forEach((line) => {
    for (let i = 0; i < line.length - 1; i++) {
      D.boundary.forEach((ring) => {
        for (let j = 0; j < ring.length - 1; j++) {
          const p = segIntersect(line[i], line[i + 1], ring[j], ring[j + 1]);
          if (p) hits.push({ x: p[0], z: p[1], road: rd.name || rd.highway, tunnel: !!rd.tunnel });
        }
      });
    }
  });
});

// 聚类（30 m 内合并）
const clusters = [];
hits.forEach((h) => {
  const c = clusters.find((c) => Math.hypot(c.x - h.x, c.z - h.z) < 30);
  if (c) { c.n++; c.roads.add(h.road); } else { clusters.push({ x: h.x, z: h.z, n: 1, roads: new Set([h.road]) }); }
});

function nearestPlace(x, z) {
  let best = null, bd = Infinity;
  D.places.forEach((p) => {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) { bd = d; best = p; }
  });
  return { label: best.label, d: Math.round(bd) };
}

console.log('边界交点聚类（x=西正, z=北正）：');
clusters
  .sort((a, b) => b.z - a.z)
  .forEach((c) => {
    const np = nearestPlace(c.x, c.z);
    console.log(`  (${c.x.toFixed(0)}, ${c.z.toFixed(0)})  x${c.n}  ${[...c.roads].join('/')}  最近: ${np.label} ${np.d}m`);
  });
