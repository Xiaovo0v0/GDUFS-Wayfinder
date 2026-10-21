import { openDify } from './dify-lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { b, close } = await openDify(9383);
try {
  await b.goto('http://172.17.1.46/integrations/model-provider', 7000);
  const txt = await b.eval(`(() => (document.body.innerText||'').replace(/\\s+/g,' ').slice(0, 700))()`, { awaitPromise: false });
  console.log('TEXT:', txt);
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/integrations.png');
} finally { await close(); }
