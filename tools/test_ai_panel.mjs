import { Browser } from './cdp.mjs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/3d';
const b = new Browser({ port: 9370, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(q, waitMs = 30000) {
  await b.eval(`(() => {
    const inp = document.getElementById('ai-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, ${JSON.stringify(q)});
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('ai-send').click();
    return 1;
  })()`, { awaitPromise: false });
  const t0 = Date.now();
  let last = '';
  let stable = 0;
  while (Date.now() - t0 < waitMs) {
    await sleep(1500);
    const txt = await b.eval(`document.getElementById('ai-body').innerText`);
    const busy = await b.eval(`document.getElementById('ai-send').disabled`);
    if (txt === last && !busy) { stable++; if (stable >= 2) return txt; } else { stable = 0; }
    last = txt;
  }
  return last;
}

try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html?v=' + Date.now());
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Page.reload', { ignoreCache: true });
  await sleep(7000);

  const a1 = await ask('从文采园怎么去图书馆？');
  console.log('--- A1 ---\n' + a1.split('\n').slice(-6).join('\n'));
  const st1 = await b.eval(`({ status: document.getElementById('status').innerText, places: window.__navDebug.currentPlaces(), badge: document.getElementById('ai-badge').innerText })`);
  console.log('state1', JSON.stringify(st1));
  await sleep(1500);
  await b.shot(`${OUT}/ai_nav.png`);

  const a2 = await ask('成绩单在哪里办？需要带什么？');
  console.log('--- A2 ---\n' + a2.split('\n').slice(-6).join('\n'));
  await b.shot(`${OUT}/ai_service.png`);

  const a3 = await ask('图书馆几层？');
  console.log('--- A3 ---\n' + a3.split('\n').slice(-4).join('\n'));
} finally {
  await b.close();
}
