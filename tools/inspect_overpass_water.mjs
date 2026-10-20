import fs from 'node:fs';

const j = JSON.parse(fs.readFileSync('C:/Users/86134/Desktop/gdufs/artifacts/geo/overpass_water.json', 'utf8'));
for (const el of j.elements) {
  const name = el.tags?.name || '(无名)';
  const members = el.members || [];
  const outer = members.filter((m) => m.role === 'outer' && m.geometry);
  const pts = outer.reduce((a, m) => a + m.geometry.length, 0);
  console.log(`${el.type}/${el.id} ${name} water=${el.tags?.water || ''} members=${members.length} outerGeom=${outer.length} pts=${pts}`);
  if (el.type === 'relation' && outer.length) {
    const g = outer[0].geometry;
    console.log('   首点', g[0]?.lat?.toFixed(6), g[0]?.lon?.toFixed(6), '末点', g[g.length - 1]?.lat?.toFixed(6), g[g.length - 1]?.lon?.toFixed(6));
  }
}
