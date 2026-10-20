import fs from 'node:fs';

const s = fs.readFileSync('C:/Users/86134/Desktop/gdufs/gdufs-3d/gdufs-data.js', 'utf8');
const D = JSON.parse(s.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

const bx = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
D.boundary.forEach((ring) => ring.forEach(([x, z]) => {
  bx.minX = Math.min(bx.minX, x); bx.maxX = Math.max(bx.maxX, x);
  bx.minZ = Math.min(bx.minZ, z); bx.maxZ = Math.max(bx.maxZ, z);
}));
console.log('campus bbox', JSON.stringify(bx));

const M = 60;
let far = 0, lines = 0, farPts = 0, totalPts = 0;
const samples = [];
for (const r of D.roads) {
  for (const line of r.lines) {
    lines++;
    let worst = 0, worstPt = null;
    for (const [x, z] of line) {
      totalPts++;
      const dx = Math.max(bx.minX - x, 0, x - bx.maxX);
      const dz = Math.max(bx.minZ - z, 0, z - bx.maxZ);
      const d = Math.hypot(dx, dz);
      if (d > worst) { worst = d; worstPt = [x, z]; }
      if (d > M) farPts++;
    }
    if (worst > M) {
      far++;
      if (samples.length < 8) samples.push({ name: r.name || '(无名)', highway: r.highway, pts: line.length, worst: Math.round(worst), at: worstPt.map(Math.round) });
    }
  }
}
console.log(`道路折线 ${lines} 条 / 点 ${totalPts} 个；超出校园 bbox ${M}m 以上的点 ${farPts} 个，折线 ${far} 条`);
samples.forEach((x) => console.log('  ', JSON.stringify(x)));
