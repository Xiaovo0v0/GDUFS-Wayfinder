import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9371, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html?v=' + Date.now());
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Page.reload', { ignoreCache: true });
  await sleep(6000);
  await b.eval(`(() => {
    const inp = document.getElementById('ai-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '从文采园怎么去图书馆？');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('ai-send').click();
    return 1;
  })()`, { awaitPromise: false });
  await sleep(20000);
  const d = await b.eval(`({
    sys: [...document.querySelectorAll('#ai-body .sys')].map(e => e.textContent),
    msgs: [...document.querySelectorAll('#ai-body .msg')].map(e => e.className + ' :: ' + e.innerText.slice(0, 30))
  })`);
  console.log(JSON.stringify(d, null, 2));
} finally {
  await b.close();
}
