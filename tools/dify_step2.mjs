import { openDify, sleep } from './dify-lib.mjs';

const DS = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const FILE = 'C:\\Users\\86134\\Desktop\\gdufs\\data\\dify\\qa_test.md';
const { b, close } = await openDify(9348);
try {
  await b.goto(`http://172.17.1.46/datasets/${DS}/documents/create`, 7000);
  await b.send('DOM.enable');
  const doc = await b.send('DOM.getDocument');
  const q = await b.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
  await b.send('DOM.setFileInputFiles', { files: [FILE], nodeId: q.nodeId });
  await sleep(2000);
  await b.eval(`(() => { const btns=[...document.querySelectorAll('button')].filter(x=>x.innerText.trim()==='下一步'); btns[btns.length-1].click(); return 1; })()`, { awaitPromise: false });
  await sleep(3500);
  const step2 = await b.eval(`({
    text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0, 2000),
    buttons: [...document.querySelectorAll('button')].map(x => (x.innerText||'').trim()).filter(Boolean).slice(-10),
    radios: [...document.querySelectorAll('[role="radio"],[role="tab"]')].map(x => (x.innerText||'').trim()).filter(Boolean)
  })`);
  console.log(JSON.stringify(step2, null, 2));
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/step2.png');
} finally {
  await close();
}
