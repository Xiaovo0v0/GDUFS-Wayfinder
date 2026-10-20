// 只用"地表"水道重建 D.water：剔除 tunnel=culvert / covered=yes 的暗渠
import fs from 'node:fs';

const ROOT = 'C:/Users/86134/Desktop/gdufs';
const FILE = `${ROOT}/gdufs-3d/gdufs-data.js`;
const raw = fs.readFileSync(FILE, 'utf8');
const D = JSON.parse(raw.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

const LON0 = D.meta.origin_wgs84.lon;
const LAT0 = D.meta.origin_wgs84.lat;
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const KZ = 110540;
const toLocal = (p) => [Number((-(p.lon - LON0) * KX).toFixed(1)), Number(((p.lat - LAT0) * KZ).toFixed(1))];

const osm = JSON.parse(fs.readFileSync(`${ROOT}/gdufs-south-campus/02_osm/landscape.json`, 'utf8'));
const els = osm.elements || osm;

const out = [];
let skipped = 0;
for (const e of els) {
  const t = e.tags || {};
  if (!['river', 'canal', 'stream', 'ditch'].includes(t.waterway)) continue;
  if (t.tunnel === 'culvert' || t.tunnel === 'yes' || t.covered === 'yes') { skipped++; continue; }
  if (!e.geometry || e.geometry.length < 2) continue;
  const pts = e.geometry.map(toLocal);
  const inCampus = pts.some((p) => p[0] > -520 && p[0] < 360 && p[1] > -860 && p[1] < 860);
  if (!inCampus) continue;
  out.push({ name: t.name || '', kind: t.waterway === 'canal' ? 'canal' : 'river', lines: [pts] });
}

D.water = out;
D.meta.water_note = '地表河道/水渠来自 OpenStreetMap（ODbL）；tunnel=culvert 的暗渠不渲染；湖面为 relation/19177031 等。';
fs.writeFileSync(FILE, 'window.GDUFS_DATA = ' + JSON.stringify(D) + ';\n', 'utf8');
console.log('surface waterways:', out.length, '| skipped culverts:', skipped);
out.forEach((w) => console.log('  ', w.name || '(无名)', w.kind, w.lines[0].length, 'pts'));
