import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/3d';
fs.mkdirSync(OUT, { recursive: true });
const url = 'file:///C:/Users/86134/Desktop/gdufs/gdufs-3d/index.html';
const b = new Browser({ port: 9335, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shots = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

try {
  await b.launch(url);
  await sleep(5000);
  for (const s of shots) {
    await b.eval(`(() => {
      const d = window.__navDebug, c = d.camera, t = d.controls.target;
      t.set(${s.tx}, 0, ${s.tz});
      c.position.set(${s.tx + s.dx}, ${s.dy}, ${s.tz + s.dz});
      c.lookAt(t.x, 0, t.z);
      d.controls.update();
      return 1;
    })()`, { awaitPromise: false });
    await sleep(900);
    await b.shot(`${OUT}/${s.name}.png`);
    console.log('shot', s.name);
  }
} finally {
  await b.close();
}
