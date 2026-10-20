import { Browser } from './cdp.mjs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/3d';
const b = new Browser({ port: 9373, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html?v=' + Date.now());
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Page.reload', { ignoreCache: true });
  await sleep(6500);

  // 制造离线：把密钥改坏
  await b.eval(`window.GDUFS_AI.key = 'app-invalid-key'`, { awaitPromise: false });

  await b.eval(`(() => {
    const inp = document.getElementById('ai-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '文采园到图书馆怎么走');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('ai-send').click();
    return 1;
  })()`, { awaitPromise: false });
  await sleep(9000);

  const d = await b.eval(`({
    badge: document.getElementById('ai-badge').innerText,
    body: document.getElementById('ai-body').innerText.split('\\n').slice(-8).join('\\n'),
    places: window.__navDebug.currentPlaces(),
    status: document.getElementById('status').innerText
  })`);
  console.log(JSON.stringify(d, null, 2));
  await b.shot(`${OUT}/ai_offline.png`);

  // 再测一次办事类离线
  await b.eval(`(() => {
    const inp = document.getElementById('ai-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '校园卡丢了怎么办');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('ai-send').click();
    return 1;
  })()`, { awaitPromise: false });
  await sleep(3000);
  const d2 = await b.eval(`document.getElementById('ai-body').innerText.split('\\n').slice(-10).join('\\n')`);
  console.log('--- offline service ---\n' + d2);
} finally {
  await b.close();
}
