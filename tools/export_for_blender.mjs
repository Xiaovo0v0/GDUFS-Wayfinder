// 从 gdufs-data.js 导出 Blender 可直接消费的建筑体块 JSON（局部米制坐标）
import fs from 'node:fs';

const FILE = 'C:/Users/86134/Desktop/gdufs/gdufs-3d/gdufs-data.js';
const raw = fs.readFileSync(FILE, 'utf8');
const D = JSON.parse(raw.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

const PALETTE = {
  academic:  { kind: 'ribbon',  wall: [196, 187, 168], accent: [156, 79, 57],  glass: [58, 74, 82] },
  dormitory: { kind: 'punch',   wall: [203, 189, 159], accent: [185, 168, 136], glass: [65, 78, 87] },
  library:   { kind: 'curtain', wall: [133, 75, 57],   accent: [111, 59, 43],  glass: [47, 90, 88] },
  canteen:   { kind: 'large',   wall: [164, 100, 76],  accent: [143, 79, 60],  glass: [60, 74, 80] },
  sports:    { kind: 'panel',   wall: [179, 191, 199], accent: [132, 150, 163], glass: [107, 132, 150] },
  culture:   { kind: 'ribbon',  wall: [185, 166, 132], accent: [156, 79, 57],  glass: [58, 74, 82] },
  clinic:    { kind: 'punch',   wall: [207, 214, 218], accent: [185, 194, 199], glass: [71, 84, 92] },
  other:     { kind: 'punch',   wall: [182, 177, 165], accent: [164, 158, 144], glass: [69, 79, 86] },
};

const out = D.buildings.map((b) => {
  const p = PALETTE[b.type] || PALETTE.other;
  return {
    id: b.id,
    name: b.name || '',
    type: b.type,
    levels: b.levels || 5,
    height: b.height,
    area: b.area,
    rings: b.rings,
    access: b.access || null,
    style: p,
  };
});

const meta = {
  origin: D.meta.origin_utm,
  crs: 'local meters, x=west positive (mirrored), z=north, y=up',
  count: out.length,
  generated: new Date().toISOString(),
};

fs.mkdirSync('C:/Users/86134/Desktop/gdufs/artifacts/blender', { recursive: true });
fs.writeFileSync('C:/Users/86134/Desktop/gdufs/artifacts/blender/buildings.json',
  JSON.stringify({ meta, buildings: out }, null, 1), 'utf8');
console.log('exported', out.length, 'buildings');
