// 修正 4 号门位置：官方平面图显示它在风采园与南苑13栋之间的内环东路上
import fs from 'node:fs';

const FILE = 'C:/Users/86134/Desktop/gdufs/gdufs-3d/gdufs-data.js';
const raw = fs.readFileSync(FILE, 'utf8');
const D = JSON.parse(raw.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

// 道路与校园边界在西南角的交点（见 tools/find_gate_crossings.mjs 输出）
const NEW_X = 223;
const NEW_Z = -746;

function nearestNode(x, z) {
  let best = 0, bd = Infinity;
  D.graph.nodes.forEach((n, i) => {
    const d = Math.hypot(n[0] - x, n[1] - z);
    if (d < bd) { bd = d; best = i; }
  });
  return { node: best, dist: bd };
}

const g = D.gates.find((x) => x.name === '4号门');
if (!g) throw new Error('4号门 not found');
g.x = NEW_X;
g.z = NEW_Z;
const nn = nearestNode(NEW_X, NEW_Z);
g.node = nn.node;
g.access_dist = Number(nn.dist.toFixed(1));
g.note = '官方平面图：西南角内环东路，风采园与南苑13栋之间。坐标取道路与校园边界交点。';

const p = D.places.find((x) => x.label === '4号门');
if (p) { p.x = NEW_X; p.z = NEW_Z; p.node = nn.node; }

fs.writeFileSync(FILE, 'window.GDUFS_DATA = ' + JSON.stringify(D) + ';\n', 'utf8');
console.log('4号门 →', NEW_X, NEW_Z, '| node', nn.node, 'dist', nn.dist.toFixed(1));
