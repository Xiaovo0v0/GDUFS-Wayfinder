import { openDify, sleep } from './dify-lib.mjs';

const { b, close } = await openDify(9393);
try {
  await b.goto('http://172.17.1.46/plugins', 8000);
  await sleep(2000);
  const first = await b.eval(`({ path: location.pathname, inputs: document.querySelectorAll('input').length, text: document.body.innerText.slice(0, 300) })`);
  console.log('page:', JSON.stringify(first));

  // 在搜索框里输入"地图"
  const r = await b.eval(`(() => {
    const inp = [...document.querySelectorAll('input')].find(i => i.type === 'text' || i.type === 'search' || !i.type);
    if (!inp) return 'no input';
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, '地图');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return 'typed';
  })()`, { awaitPromise: false });
  console.log('search:', r);
  await sleep(4000);
  const res = await b.eval(`document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0, 1800)`);
  console.log(res);
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/market_search.png');
} finally {
  await close();
}
