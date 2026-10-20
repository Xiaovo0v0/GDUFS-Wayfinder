import { Browser } from './cdp.mjs';

const url = 'file:///C:/Users/86134/Desktop/gdufs/gdufs-3d/index.html';
const b = new Browser({ port: 9335, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await b.launch(url);
  await sleep(5000);
  const info = await b.eval(`(() => {
    const d = window.__navDebug, sc = d.scene;
    const std = [];
    sc.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m && m.type === 'MeshStandardMaterial') {
        std.push({ geo: o.geometry.type, color: '#' + m.color.getHexString(), map: !!m.map });
      }
    });
    return { count: std.length, first: std.slice(0, 6), roofsOnly: std.filter(x => x.geo === 'ShapeGeometry').slice(0, 6) };
  })()`);
  console.log(JSON.stringify(info, null, 2));

  // sample pixel colors from canvas at given points
  const px = await b.eval(`(() => {
    const c = document.querySelector('canvas');
    const g = c.getContext('webgl2') || c.getContext('webgl');
    return { w: c.width, h: c.height };
  })()`);
  console.log(JSON.stringify(px));
} finally {
  await b.close();
}
