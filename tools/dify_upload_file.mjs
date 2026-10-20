import { openDify, sleep } from './dify-lib.mjs';
import fs from 'node:fs';

const DS = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const FILE = process.argv[2] || 'C:\\Users\\86134\\Desktop\\gdufs\\data\\dify\\qa_test.md';
const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';

const { b, close } = await openDify(9346);
try {
  await b.goto(`http://172.17.1.46/datasets/${DS}/documents/create`, 7000);
  await b.send('Network.enable');
  await b.send('DOM.enable');
  b.events.length = 0;

  const doc = await b.send('DOM.getDocument');
  const q = await b.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
  console.log('file input nodeId:', q.nodeId);
  if (!q.nodeId) {
    const info = await b.eval(`({ inputs: [...document.querySelectorAll('input')].map(i => i.type), text: document.body.innerText.slice(0, 400) })`);
    console.log(JSON.stringify(info));
    throw new Error('no file input');
  }
  await b.send('DOM.setFileInputFiles', { files: [FILE], nodeId: q.nodeId });
  await sleep(2500);
  await b.shot(`${OUT}/upload_step1.png`);

  const state1 = await b.eval(`document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0, 800)`);
  console.log('after set files:\n', state1);

  for (let i = 0; i < 3; i++) {
    const clicked = await b.eval(`(() => {
      const btns = [...document.querySelectorAll('button')].filter(x => ['下一步','保存并处理','保存','处理','开始处理'].includes((x.innerText||'').trim()));
      if (!btns.length) return 'nf';
      const btn = btns[btns.length-1];
      if (btn.disabled) return 'disabled';
      btn.click(); return btn.innerText.trim();
    })()`, { awaitPromise: false });
    console.log('click', i, clicked);
    await sleep(3000);
    await b.shot(`${OUT}/upload_step${i + 2}.png`);
    if (clicked === 'nf' || clicked === 'disabled') break;
  }

  await sleep(4000);
  const reqs = b.events
    .filter(e => e.method === 'Network.requestWillBeSent' && e.params.request.url.includes('/console/api/datasets/') && e.params.request.method === 'POST')
    .map(e => ({ url: e.params.request.url.replace('http://172.17.1.46', ''), body: (e.params.request.postData || '').slice(0, 2000) }));
  console.log(JSON.stringify(reqs, null, 2));
  fs.writeFileSync(`${OUT}/upload-request.json`, JSON.stringify(reqs, null, 2), 'utf8');
} finally {
  await close();
}
