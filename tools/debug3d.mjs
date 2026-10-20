import { Browser } from './cdp.mjs';

const url = 'file:///C:/Users/86134/Desktop/gdufs/gdufs-3d/index.html';
const b = new Browser({ port: 9335, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await b.launch(url);
  await sleep(5000);
  const info = await b.eval(`(() => {
    const d = window.__navDebug, sc = d.scene;
    let mats = [], roofs = 0, walls = 0;
    sc.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      if (!m) return;
      if (m.map) walls++; else if (o.geometry.type === 'ShapeGeometry') roofs++;
      if (mats.length < 8) mats.push({ type: o.geometry.type, color: m.color ? '#' + m.color.getHexString() : null, hasMap: !!m.map, tone: d.renderer.toneMapping, exp: d.renderer.toneMappingExposure });
    });
    return { roofs, walls, mats, lt: d.renderer.outputEncoding };
  })()`);
  console.log(JSON.stringify(info, null, 2));
} finally {
  await b.close();
}
