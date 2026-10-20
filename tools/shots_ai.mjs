import { Browser } from './cdp.mjs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/3d';
const b = new Browser({ port: 9374, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(q, ms = 25000) {
  await b.eval(`(() => {
    const inp = document.getElementById('ai-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, ${JSON.stringify(q)});
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('ai-send').click();
    return 1;
  })()`, { awaitPromise: false });
  await sleep(ms);
}

try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html?v=' + Date.now());
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Page.reload', { ignoreCache: true });
  await sleep(6500);

  await ask('从文采园怎么去图书馆？', 22000);
  await b.shot(`${OUT}/ai_nav.png`);

  await ask('成绩单在哪里办？需要带什么？', 18000);
  await b.shot(`${OUT}/ai_service.png`);

  await ask('第一饭堂几点开门？', 15000);
  await b.shot(`${OUT}/ai_wiki.png`);

  const txt = await b.eval(`document.getElementById('ai-body').innerText`);
  console.log(txt.split('\n').slice(-12).join('\n'));
} finally {
  await b.close();
}
