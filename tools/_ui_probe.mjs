import { Browser } from './cdp.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = new Browser({ port: 9376, visible: false });
await b.launch('http://172.17.1.46/signin');
await sleep(2500);
const { openDify } = await import('./dify-lib.mjs');
// 复用 openDify 的登录逻辑比较麻烦，这里直接用已有 profile 的会话
await b.goto('http://172.17.1.46/model-provider/langgenius/openai_api_compatible/openai_api_compatible', 4000);
const info = await b.eval(`(() => {
  const path = location.pathname;
  const btns = [...document.querySelectorAll('button')].map(x => (x.innerText||'').trim()).filter(Boolean).slice(0, 25);
  const inputs = [...document.querySelectorAll('input')].map(x => x.placeholder || x.name || x.type).slice(0, 10);
  return JSON.stringify({ path, btns, inputs });
})()`, { awaitPromise: false });
console.log(info);
await b.close();
