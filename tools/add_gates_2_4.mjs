// 补齐官方 6 个校门中的 2 号门 / 4 号门
// 依据：官方平面图上两门分别位于「外环东路南段·友苑南侧」「内环东路·风采园旁」，
// 位置用 OSM 道路与校园边界的交点推算（见 tools/find_gate_crossings.mjs 输出）。
import fs from 'node:fs';

const FILE = 'C:/Users/86134/Desktop/gdufs/gdufs-3d/gdufs-data.js';
const raw = fs.readFileSync(FILE, 'utf8');
const D = JSON.parse(raw.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

const CANDIDATES = [
  {
    name: '2号门',
    x: -25,
    z: -576,
    note: '官方平面图：外环东路南段、友苑南侧，通往宿舍区。坐标按道路与边界交点推算。',
  },
  {
    name: '4号门',
    x: 284,
    z: -706,
    note: '官方平面图：西南角内环东路、风采园（第三饭堂）旁、南苑13栋侧。坐标按道路与边界交点推算。',
  },
];

function nearestNode(x, z) {
  let best = 0, bd = Infinity;
  D.graph.nodes.forEach((n, i) => {
    const d = Math.hypot(n[0] - x, n[1] - z);
    if (d < bd) { bd = d; best = i; }
  });
  return { node: best, dist: bd };
}

let added = 0;
for (const c of CANDIDATES) {
  if (D.gates.some((g) => g.name === c.name)) { console.log('exists', c.name); continue; }
  const { node, dist } = nearestNode(c.x, c.z);
  D.gates.push({
    name: c.name,
    entrance: 'main',
    barrier: 'gate',
    x: c.x,
    z: c.z,
    node,
    access_dist: Number(dist.toFixed(1)),
    name_confidence: 'inferred',
    note: c.note,
  });
  D.places.push({ label: c.name, x: c.x, z: c.z, kind: 'gate', node, ref: c.name });
  added++;
  console.log('added', c.name, 'node', node, 'dist', dist.toFixed(1));
}

D.meta.gates_note = '6 个出入口均按官方平面图命名；2/4 号门坐标由 OSM 道路与边界交点推算，待现场核实。';

fs.writeFileSync(FILE, 'window.GDUFS_DATA = ' + JSON.stringify(D) + ';\n', 'utf8');
console.log('gates now:', D.gates.map((g) => g.name).join(' / '), '| places', D.places.length);
