// 把道路折线裁剪到「校园 bbox 外扩 80 m」，去掉伸向城区的长尾巴
import fs from 'node:fs';

const FILE = 'C:/Users/86134/Desktop/gdufs/gdufs-3d/gdufs-data.js';
const raw = fs.readFileSync(FILE, 'utf8');
const D = JSON.parse(raw.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

const bx = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
D.boundary.forEach((ring) => ring.forEach(([x, z]) => {
  bx.minX = Math.min(bx.minX, x); bx.maxX = Math.max(bx.maxX, x);
  bx.minZ = Math.min(bx.minZ, z); bx.maxZ = Math.max(bx.maxZ, z);
}));
const M = 80;
const rect = { x0: bx.minX - M, x1: bx.maxX + M, z0: bx.minZ - M, z1: bx.maxZ + M };

// Liang–Barsky 线段裁剪
function clipSeg(a, b) {
  let [x0, y0] = a, [x1, y1] = b;
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - rect.x0, rect.x1 - x0, y0 - rect.z0, rect.z1 - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; }
    else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
  }
  return [[x0 + t0 * dx, y0 + t0 * dy], [x0 + t1 * dx, y0 + t1 * dy]];
}

let before = 0, after = 0, dropped = 0;
for (const r of D.roads) {
  const newLines = [];
  for (const line of r.lines) {
    before += line.length;
    let cur = [];
    for (let i = 0; i < line.length - 1; i++) {
      const seg = clipSeg(line[i], line[i + 1]);
      if (!seg) { if (cur.length > 1) newLines.push(cur); cur = []; continue; }
      const [p0, p1] = seg;
      if (!cur.length) cur.push([+p0[0].toFixed(1), +p0[1].toFixed(1)]);
      else {
        const last = cur[cur.length - 1];
        if (Math.hypot(last[0] - p0[0], last[1] - p0[1]) > 0.5) { if (cur.length > 1) newLines.push(cur); cur = [[+p0[0].toFixed(1), +p0[1].toFixed(1)]]; }
      }
      cur.push([+p1[0].toFixed(1), +p1[1].toFixed(1)]);
    }
    if (cur.length > 1) newLines.push(cur);
  }
  dropped += r.lines.length - newLines.length;
  r.lines = newLines.filter((l) => l.length > 1);
  after += r.lines.reduce((a, l) => a + l.length, 0);
}
D.roads = D.roads.filter((r) => r.lines.length);

fs.writeFileSync(FILE, 'window.GDUFS_DATA = ' + JSON.stringify(D) + ';\n', 'utf8');
console.log(`道路点 ${before} → ${after}，折线减少 ${dropped}，剩余道路 ${D.roads.length} 条`);
