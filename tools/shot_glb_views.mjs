import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/3d';
const b = new Browser({ port: 9337, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const views = [
  { name: 'glb_close_teach', tx: 120, tz: -120, dx: 90, dy: 55, dz: 120 },
  { name: 'glb_close_lib', tx: -20, tz: 60, dx: 80, dy: 50, dz: 90 },
  { name: 'glb_axon', tx: 0, tz: -40, dx: -330, dy: 520, dz: 420 },
];

try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html');
  await sleep(7000);
  for (const v of views) {
    await b.eval(`(() => { const d = window.__navDebug, c = d.camera, t = d.controls.target;
      t.set(${v.tx}, 0, ${v.tz}); c.position.set(${v.tx + v.dx}, ${v.dy}, ${v.tz + v.dz});
      c.lookAt(t.x, 0, t.z); d.controls.update(); return 1; })()`, { awaitPromise: false });
    await sleep(900);
    await b.shot(`${OUT}/${v.name}.png`);
    console.log('shot', v.name);
  }
} finally {
  await b.close();
}
