import { openDify } from './dify-lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { b, close } = await openDify(9380);
try {
  await b.goto('http://172.17.1.46/apps', 6000);
  const links = await b.eval(`(() => {
    const s = new Set();
    document.querySelectorAll('a[href]').forEach(a => s.add(a.getAttribute('href')));
    return JSON.stringify([...s].filter(h => /model|setting|provider|plugin/i.test(h)).slice(0, 30));
  })()`, { awaitPromise: false });
  console.log('links:', links);
  const txt = await b.eval(`(() => (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,400))()`, { awaitPromise: false });
  console.log('text:', txt);
} finally { await close(); }
