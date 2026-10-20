// 把 Overpass 拉到的湖面 relation 拼成闭合环，投影到本地坐标，输出 water_polygons.json
import fs from 'node:fs';

const ROOT = 'C:/Users/86134/Desktop/gdufs';
const raw = fs.readFileSync(`${ROOT}/artifacts/geo/overpass_lakes.json`, 'utf8').replace(/^\uFEFF/, '');
const j = JSON.parse(raw);
const D = JSON.parse(
  fs.readFileSync(`${ROOT}/gdufs-3d/gdufs-data.js`, 'utf8')
    .replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, '')
);

const LON0 = D.meta.origin_wgs84.lon;
const LAT0 = D.meta.origin_wgs84.lat;
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const KZ = 110540;
const toLocal = (lon, lat) => [-(lon - LON0) * KX, (lat - LAT0) * KZ];

// 拼接 way 成环
function stitch(ways) {
  const segs = ways.map((w) => w.slice());
  const rings = [];
  while (segs.length) {
    let cur = segs.shift();
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        const a = cur[cur.length - 1];
        if (Math.abs(a[0] - s[0][0]) < 1e-9 && Math.abs(a[1] - s[0][1]) < 1e-9) {
          cur = cur.concat(s.slice(1)); segs.splice(i, 1); changed = true; break;
        }
        if (Math.abs(a[0] - s[s.length - 1][0]) < 1e-9 && Math.abs(a[1] - s[s.length - 1][1]) < 1e-9) {
          cur = cur.concat(s.slice().reverse().slice(1)); segs.splice(i, 1); changed = true; break;
        }
      }
    }
    rings.push(cur);
  }
  return rings;
}

const out = [];
for (const rel of j.elements) {
  const ways = (rel.members || [])
    .filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry)
    .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  if (!ways.length) continue;
  for (const ring of stitch(ways)) {
    if (ring.length < 4) continue;
    const first = ring[0], last = ring[ring.length - 1];
    const closed = Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9;
    if (!closed) continue;
    const local = ring.slice(0, -1).map(([lon, lat]) => {
      const p = toLocal(lon, lat);
      return [Number(p[0].toFixed(1)), Number(p[1].toFixed(1))];
    });
    const cx = local.reduce((a, p) => a + p[0], 0) / local.length;
    const cz = local.reduce((a, p) => a + p[1], 0) / local.length;
    const inCampus = cx > -520 && cx < 360 && cz > -860 && cz < 860;
    out.push({
      relation: `relation/${rel.id}`,
      name: rel.tags?.name || '',
      water: rel.tags?.water || '',
      points: local.length,
      centroid: [Number(cx.toFixed(0)), Number(cz.toFixed(0))],
      inCampus,
      ring: local,
    });
  }
}

fs.writeFileSync(`${ROOT}/artifacts/geo/water_polygons.json`, JSON.stringify(out, null, 1), 'utf8');
out.forEach((o) => console.log(`${o.name || '(无名)'} ${o.relation} pts=${o.points} 质心=(${o.centroid}) 校园内=${o.inCampus}`));
