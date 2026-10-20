import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/3d';
fs.mkdirSync(OUT, { recursive: true });
const url = 'file:///C:/Users/86134/Desktop/gdufs/gdufs-3d/index.html';
const b = new Browser({ port: 9335, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await b.launch(url);
  await sleep(5500);

  // 路线演示：文采园 → 图书馆
  const res = await b.eval(`(() => {
    const ss = document.getElementById('startSelect'), es = document.getElementById('endSelect');
    const opt = [...ss.options].find(o => o.text.includes('文采园'));
    const opt2 = [...es.options].find(o => o.text.includes('图书馆'));
    if (!opt || !opt2) return { err: 'option missing', opts: [...ss.options].map(o => o.text).slice(0, 60) };
    ss.value = opt.value; ss.dispatchEvent(new Event('change'));
    es.value = opt2.value; es.dispatchEvent(new Event('change'));
    return { start: opt.text, end: opt2.text, status: document.getElementById('status').innerText };
  })()`, { awaitPromise: false });
  console.log(JSON.stringify(res));
  await sleep(1200);
  await b.shot(`${OUT}/v3_route.png`);

  // 全程视角
  await b.eval(`(() => { const d = window.__navDebug, c = d.camera, t = d.controls.target;
    t.set(0, 0, -40); c.position.set(-330, 520, 420); c.lookAt(0, 0, -40); d.controls.update(); return 1; })()`, { awaitPromise: false });
  await sleep(900);
  await b.shot(`${OUT}/v3_axon.png`);
  console.log('done');
} finally {
  await b.close();
}
