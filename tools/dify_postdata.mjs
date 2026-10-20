import { openDify, sleep } from './dify-lib.mjs';
import fs from 'node:fs';

const DS = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const FILE = 'C:\\Users\\86134\\Desktop\\gdufs\\data\\dify\\qa_test.md';
const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const { b, close } = await openDify(9350);
try {
  await b.goto(`http://172.17.1.46/datasets/${DS}/documents/create`, 7000);
  await b.send('Network.enable');
  await b.send('DOM.enable');
  b.events.length = 0;

  const doc = await b.send('DOM.getDocument');
  const q = await b.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
  await b.send('DOM.setFileInputFiles', { files: [FILE], nodeId: q.nodeId });
  await sleep(2000);
  await b.eval(`(() => { const btns=[...document.querySelectorAll('button')].filter(x=>x.innerText.trim()==='下一步'); btns[btns.length-1].click(); return 1; })()`, { awaitPromise: false });
  await sleep(3000);
  await b.eval(`(() => { const btns=[...document.querySelectorAll('button')].filter(x=>x.innerText.trim()==='保存并处理'); btns[btns.length-1].click(); return 1; })()`, { awaitPromise: false });
  await sleep(4000);

  const req = b.events
    .filter(e => e.method === 'Network.requestWillBeSent' && e.params.request.url.includes('/documents') && e.params.request.method === 'POST')
    .pop();
  console.log('req url:', req && req.params.request.url);
  console.log('has postData:', !!(req && req.params.request.postData));
  if (req) {
    try {
      const pd = await b.send('Network.getRequestPostData', { requestId: req.params.requestId });
      console.log('postData len', (pd.postData || '').length);
      fs.writeFileSync(`${OUT}/postdata.txt`, pd.postData || '', 'utf8');
      console.log((pd.postData || '').slice(0, 1500));
    } catch (e) {
      console.log('getPostData err', String(e).slice(0, 200));
    }
  }
} finally {
  await close();
}
