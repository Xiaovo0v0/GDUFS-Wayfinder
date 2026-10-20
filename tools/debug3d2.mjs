import { Browser } from './cdp.mjs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/3d';
const url = 'file:///C:/Users/86134/Desktop/gdufs/gdufs-3d/index.html';
const b = new Browser({ port: 9335, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await b.launch(url);
  await sleep(5000);
  const res = await b.eval(`(() => {
    const d = window.__navDebug, sc = d.scene;
    let n = 0, sample = [];
    sc.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      if (bb.max.y > 5) {
        o.material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        n++;
        if (sample.length < 5) sample.push({ maxY: bb.max.y.toFixed(1), type: o.geometry.type });
      }
    });
    return { n, sample };
  })()`);
  console.log(JSON.stringify(res));
  await sleep(800);
  await b.shot(`${OUT}/debug_red.png`);
} finally {
  await b.close();
}
