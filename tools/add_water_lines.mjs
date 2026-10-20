// 把 OSM 的河道/水渠线（LineString）投影到本地坐标，补进 gdufs-data.js
// 说明：语心湖本身 OSM 未测绘，这里只补有开放数据的河道与水渠。
import fs from 'node:fs';

const ROOT = 'C:/Users/86134/Desktop/gdufs';
const FILE = `${ROOT}/gdufs-3d/gdufs-data.js`;
const raw = fs.readFileSync(FILE, 'utf8');
const D = JSON.parse(raw.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

const geo = JSON.parse(fs.readFileSync(`${ROOT}/gdufs-south-campus/04_gis/landscape.geojson`, 'utf8'));

const LON0 = D.meta.origin_wgs84.lon;
const LAT0 = D.meta.origin_wgs84.lat;
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const KZ = 110540;

// 镜像后 x = 西正（东为负）
const toLocal = (c) => [-(c[0] - LON0) * KX, (c[1] - LAT0) * KZ];

// 用边界点验证投影精度
const bGeo = JSON.parse(fs.readFileSync(`${ROOT}/gdufs-south-campus/04_gis/campus_boundary.geojson`, 'utf8'));
const feat = bGeo.features[0];
const ringLonLat = feat.geometry.type === 'MultiPolygon'
  ? feat.geometry.coordinates[0][0]
  : feat.geometry.coordinates[0];
const projected = ringLonLat.map(toLocal);
// 取 D.boundary 里最近的点算残差
let maxErr = 0;
projected.slice(0, 200).forEach((p) => {
  let best = Infinity;
  D.boundary.forEach((ring) => ring.forEach((q) => {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < best) best = d;
  }));
  if (best > maxErr) maxErr = best;
});
console.log('投影与模型边界的最大偏差:', maxErr.toFixed(1), 'm');

const water = [];
for (const f of geo.features) {
  const kind = f.properties.kind;
  if (kind !== 'river' && kind !== 'canal') continue;
  const coords = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const line of coords) {
    const pts = line.map(toLocal);
    // 只保留与校园范围相交的线（粗略：至少一个点落在边界 bbox 内）
    const inCampus = pts.some((p) => p[0] > -520 && p[0] < 360 && p[1] > -860 && p[1] < 860);
    if (!inCampus) continue;
    water.push({ name: f.properties.name || '', kind, lines: [pts.map((p) => [Number(p[0].toFixed(1)), Number(p[1].toFixed(1))])] });
  }
}

D.water = water;
D.meta.water_note = '河道/水渠来自 OpenStreetMap（ODbL）；语心湖水面 OSM 未测绘，暂缺。';
fs.writeFileSync(FILE, 'window.GDUFS_DATA = ' + JSON.stringify(D) + ';\n', 'utf8');
console.log('water features:', water.length, '| total points:', water.reduce((a, w) => a + w.lines[0].length, 0));
water.forEach((w) => console.log('  ', w.name || '(无名)', w.kind, w.lines[0].length, 'pts'));
