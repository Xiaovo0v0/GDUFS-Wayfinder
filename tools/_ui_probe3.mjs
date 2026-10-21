import { openDify } from './dify-lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { b, close } = await openDify(9378);
try {
  await b.goto('http://172.17.1.46/model-provider/langgenius/openai_api_compatible/openai_api_compatible', 8000);
  const txt = await b.eval(`(() => (document.body.innerText || '').replace(/\\s+/g,' ').slice(0, 600))()`, { awaitPromise: false });
  console.log('TEXT:', txt);
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/provider_page.png');
} finally { await close(); }
