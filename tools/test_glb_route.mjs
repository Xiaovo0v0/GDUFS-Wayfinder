import { Browser } from './cdp.mjs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/3d';
const b = new Browser({ port: 9338, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html');
  await sleep(7000);
  const res = await b.eval(`(() => {
    const ss = document.getElementById('startSelect'), es = document.getElementById('endSelect');
    const o1 = [...ss.options].find(o => o.text.includes('文采园'));
    const o2 = [...es.options].find(o => o.text.includes('图书馆'));
    ss.value = o1.value; ss.dispatchEvent(new Event('change'));
    es.value = o2.value; es.dispatchEvent(new Event('change'));
    return { start: o1.text, end: o2.text, status: document.getElementById('status').innerText };
  })()`, { awaitPromise: false });
  console.log(JSON.stringify(res, null, 2));
  await sleep(1000);
  await b.eval(`(() => { const d = window.__navDebug, c = d.camera, t = d.controls.target; t.set(60,0,-20); c.position.set(150, 260, 260); c.lookAt(60,0,-20); d.controls.update(); return 1; })()`, { awaitPromise: false });
  await sleep(800);
  await b.shot(`${OUT}/glb_route.png`);
  console.log('shot ok');
} finally {
  await b.close();
}
