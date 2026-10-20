import fs from 'node:fs';
const s = fs.readFileSync('C:/Users/86134/Desktop/gdufs/gdufs-3d/gdufs-data.js', 'utf8');
const D = JSON.parse(s.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

const pts = [];
D.boundary.forEach((ring) => ring.forEach((p) => pts.push(p)));

// 南部（z < -550）边界点，按 x 升序（x 越小越靠东）
const south = pts.filter((p) => p[1] < -550).sort((a, b) => a[0] - b[0]);
console.log('南部边界点（东侧 8 个）:');
south.slice(0, 8).forEach((p) => console.log(`  (${p[0].toFixed(0)}, ${p[1].toFixed(0)})`));
console.log('南部边界点（西侧 5 个）:');
south.slice(-5).forEach((p) => console.log(`  (${p[0].toFixed(0)}, ${p[1].toFixed(0)})`));

// 各 z 分段的东边界
console.log('\n按 z 分段的东边界（x 最小点）:');
for (let z0 = -800; z0 < -400; z0 += 50) {
  const band = pts.filter((p) => p[1] >= z0 && p[1] < z0 + 50);
  if (!band.length) continue;
  const east = band.reduce((m, p) => (p[0] < m[0] ? p : m), band[0]);
  const west = band.reduce((m, p) => (p[0] > m[0] ? p : m), band[0]);
  console.log(`  z ${z0}~${z0 + 50}: 东 (${east[0].toFixed(0)}, ${east[1].toFixed(0)})  西 (${west[0].toFixed(0)}, ${west[1].toFixed(0)})`);
}
