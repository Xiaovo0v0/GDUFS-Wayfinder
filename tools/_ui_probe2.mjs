import { openDify } from './dify-lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { b, close } = await openDify(9377);
try {
  await b.goto('http://172.17.1.46/model-provider/langgenius/openai_api_compatible/openai_api_compatible', 5000);
  const info = await b.eval(`(() => {
    const btns = [...document.querySelectorAll('button')].map(x => (x.innerText||'').trim()).filter(Boolean).slice(0, 30);
    return JSON.stringify({ path: location.pathname, title: document.title, btns });
  })()`, { awaitPromise: false });
  console.log(info);
} finally { await close(); }
