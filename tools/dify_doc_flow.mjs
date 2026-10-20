import { openDify, sleep } from './dify-lib.mjs';
import fs from 'node:fs';

const DS = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const TEST = 'Q: 测试问题一？\nA: 测试答案一\n\nQ: 测试问题二？\nA: 测试答案二';
const { b, close } = await openDify(9344);
try {
  await b.goto(`http://172.17.1.46/datasets/${DS}/documents/create`, 6000);
  await b.send('Network.enable');
  b.events.length = 0;

  // 1) 选择"导入已有文本"
  const r1 = await b.eval(`(() => {
    const el = [...document.querySelectorAll('div,button,label')].find(x => (x.innerText||'').trim() === '导入已有文本');
    if (!el) return 'nf';
    el.click(); return 'ok';
  })()`, { awaitPromise: false });
  await sleep(1500);

  // 2) 填文本
  const r2 = await b.eval(`(() => {
    const tas = [...document.querySelectorAll('textarea')];
    if (!tas.length) return 'no textarea: ' + document.body.innerText.slice(0,400);
    const ta = tas[tas.length - 1];
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, ${JSON.stringify(TEST)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    return 'filled ' + ta.value.length;
  })()`, { awaitPromise: false });
  console.log('select:', r1, '| fill:', r2);
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/ds_step1.png');

  // 3) 下一步
  for (let step = 0; step < 3; step++) {
    const clicked = await b.eval(`(() => {
      const btns = [...document.querySelectorAll('button')].filter(x => ['下一步','保存并处理','保存','处理'].includes((x.innerText||'').trim()));
      if (!btns.length) return 'nf';
      btns[btns.length-1].click(); return (btns[btns.length-1].innerText||'').trim();
    })()`, { awaitPromise: false });
    console.log('step', step, 'clicked:', clicked);
    await sleep(2500);
    await b.shot(`C:/Users/86134/Desktop/gdufs/artifacts/dify/ds_step${step + 2}.png`);
  }

  await sleep(3000);
  const reqs = b.events
    .filter(e => e.method === 'Network.requestWillBeSent' && e.params.request.url.includes('/console/api/datasets/') && e.params.request.method === 'POST')
    .map(e => ({ url: e.params.request.url.replace('http://172.17.1.46',''), body: (e.params.request.postData || '').slice(0, 1500) }));
  console.log(JSON.stringify(reqs, null, 2));
  fs.writeFileSync('C:/Users/86134/Desktop/gdufs/artifacts/dify/create-doc-request.json', JSON.stringify(reqs, null, 2));

  const after = await b.eval(`({ path: location.pathname, text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,600) })`);
  console.log(JSON.stringify(after));
} finally {
  await close();
}
