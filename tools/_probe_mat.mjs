import { Browser } from './cdp.mjs';
const b = new Browser({ port: 9349, visible: false });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
try {
  await b.launch('http://127.0.0.1:8080/index.html?cb=' + Date.now());
  await sleep(12000);
  const r = await b.eval(`(() => {
    const d = window.__navDebug || {};
    return { mode: d.mode, clutterCalled: d.clutterCalled, clutter: d.roofClutter };
  })()`, { awaitPromise: false });
  console.log(JSON.stringify(r));
} finally { await b.close(); }
