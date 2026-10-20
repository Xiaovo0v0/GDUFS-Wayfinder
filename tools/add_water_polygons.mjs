import fs from 'node:fs';

const ROOT = 'C:/Users/86134/Desktop/gdufs';
const polys = JSON.parse(fs.readFileSync(`${ROOT}/artifacts/geo/water_polygons.json`, 'utf8'));

const FILE = `${ROOT}/gdufs-3d/gdufs-data.js`;
const raw = fs.readFileSync(FILE, 'utf8');
const D = JSON.parse(raw.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

const NAMES = {
  'relation/19177031': '语心湖',
  'relation/19159564': '湖面（体育场东侧）',
};

D.waterPolygons = polys
  .filter((p) => p.inCampus)
  .map((p) => ({
    name: NAMES[p.relation] || p.name || '水面',
    source: `OpenStreetMap ${p.relation}`,
    rings: [p.ring],
  }));

D.meta.water_note = '河道/水渠与湖面均来自 OpenStreetMap（ODbL）；语心湖为 relation/19177031。';

fs.writeFileSync(FILE, 'window.GDUFS_DATA = ' + JSON.stringify(D) + ';\n', 'utf8');
console.log('waterPolygons:', D.waterPolygons.length, D.waterPolygons.map((w) => `${w.name}(${w.rings[0].length}pts)`).join(', '));
