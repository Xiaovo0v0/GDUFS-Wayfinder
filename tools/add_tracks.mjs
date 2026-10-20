// 补田径场（Overture/OSM relation 的 track 面，带内环），投影后加入 landscape
import fs from 'node:fs';

const ROOT = 'C:/Users/86134/Desktop/gdufs';
const FILE = `${ROOT}/gdufs-3d/gdufs-data.js`;
const raw = fs.readFileSync(FILE, 'utf8');
const D = JSON.parse(raw.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

const LON0 = D.meta.origin_wgs84.lon;
const LAT0 = D.meta.origin_wgs84.lat;
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const KZ = 110540;
const toLocal = (c) => [Number((-(c[0] - LON0) * KX).toFixed(1)), Number(((c[1] - LAT0) * KZ).toFixed(1))];

const land = JSON.parse(fs.readFileSync(`${ROOT}/gdufs-south-campus/02_osm/overture_landuse.geojson`, 'utf8'));
const tracks = land.features.filter((f) => f.properties.class === 'track');

let added = 0;
for (const f of tracks) {
  const rings = f.geometry.coordinates.map((ring) => ring.map(toLocal));
  const outer = rings[0];
  const cx = outer.reduce((a, p) => a + p[0], 0) / outer.length;
  const cz = outer.reduce((a, p) => a + p[1], 0) / outer.length;
  const inCampus = cx > -520 && cx < 360 && cz > -860 && cz < 860;
  if (!inCampus) continue;
  if (D.landscape.some((l) => l.sport === 'running' && Math.abs(l.rings[0][0][0] - outer[0][0]) < 1 && Math.abs(l.rings[0][0][1] - outer[0][1]) < 1)) continue;
  D.landscape.push({
    name: '',
    kind: 'track',
    water: false,
    pitch: true,
    sport: 'running',
    source: 'Overture/OSM',
    rings,
  });
  added++;
  console.log('added track at', cx.toFixed(0), cz.toFixed(0), 'rings', rings.length);
}

fs.writeFileSync(FILE, 'window.GDUFS_DATA = ' + JSON.stringify(D) + ';\n', 'utf8');
console.log('tracks added', added, '| landscape', D.landscape.length);
