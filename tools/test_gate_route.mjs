import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9375, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html?v=' + Date.now());
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Page.reload', { ignoreCache: true });
  await sleep(6500);
  const r = await b.eval(`(() => {
    const ss = document.getElementById('startSelect'), es = document.getElementById('endSelect');
    const pick = (sel, txt) => [...sel.options].find(o => o.text.includes(txt));
    const o1 = pick(ss, '2号门'), o2 = pick(es, '图书馆');
    if (!o1 || !o2) return { err: 'option missing', gates: [...ss.options].map(o => o.text).filter(t => t.includes('门')) };
    ss.value = o1.value; ss.dispatchEvent(new Event('change'));
    es.value = o2.value; es.dispatchEvent(new Event('change'));
    return { start: o1.text, end: o2.text, status: document.getElementById('status').innerText };
  })()`, { awaitPromise: false });
  console.log(JSON.stringify(r, null, 2));
  await sleep(1200);
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/3d/v8_route_gate2.png');
} finally {
  await b.close();
}
