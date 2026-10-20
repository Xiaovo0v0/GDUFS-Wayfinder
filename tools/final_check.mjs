import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9376, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html?v=' + Date.now());
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Page.reload', { ignoreCache: true });
  await sleep(7000);

  const info = await b.eval(`({
    mode: window.__navDebug.mode,
    labels: document.querySelectorAll('.lbl').length,
    places: window.__navDebug.placeLabels.length,
    gates: window.__navDebug.placeLabels.filter(l => l.indexOf('门') >= 0 || l.indexOf('出入口') >= 0),
    water: (window.GDUFS_DATA.water || []).length,
    ai: !!document.getElementById('ai')
  })`);
  console.log(JSON.stringify(info, null, 2));

  // 问一个校门问题
  await b.eval(`(() => {
    const inp = document.getElementById('ai-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '一共有几个校门？分别叫什么？');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('ai-send').click();
    return 1;
  })()`, { awaitPromise: false });
  await sleep(22000);
  const ans = await b.eval(`document.getElementById('ai-body').innerText`);
  console.log('--- AI 回答 ---');
  console.log(ans.split('\n').slice(-8).join('\n'));
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/3d/final_round3.png');
} finally {
  await b.close();
}
