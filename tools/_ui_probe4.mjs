import { openDify } from './dify-lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { b, close } = await openDify(9379);
try {
  const urls = [
    'http://172.17.1.46/model-provider/langgenius%2Fopenai_api_compatible%2Fopenai_api_compatible',
    'http://172.17.1.46/model-provider',
  ];
  for (const u of urls) {
    await b.goto(u, 6000);
    const txt = await b.eval(`(() => (document.body.innerText || '').replace(/\\s+/g,' ').slice(0, 260))()`, { awaitPromise: false });
    console.log(u, '\n   →', txt, '\n');
  }
} finally { await close(); }
