import { openDify, sleep } from './dify-lib.mjs';

const DS = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const FILE = 'C:\\Users\\86134\\Desktop\\gdufs\\data\\dify\\qa_test.md';
const { b, close } = await openDify(9349);
try {
  await b.goto(`http://172.17.1.46/datasets/${DS}/documents/create`, 7000);
  await b.send('DOM.enable');
  const doc = await b.send('DOM.getDocument');
  const q = await b.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
  await b.send('DOM.setFileInputFiles', { files: [FILE], nodeId: q.nodeId });
  await sleep(2000);
  await b.eval(`(() => { const btns=[...document.querySelectorAll('button')].filter(x=>x.innerText.trim()==='下一步'); btns[btns.length-1].click(); return 1; })()`, { awaitPromise: false });
  await sleep(3000);

  const dom = await b.eval(`(() => {
    const el = [...document.querySelectorAll('*')].find(x => (x.innerText||'').trim().startsWith('使用 Q&A 分段'));
    if (!el) return { found: false, switches: document.querySelectorAll('[role="switch"],input[type="checkbox"]').length };
    let p = el, chain = [];
    for (let i = 0; i < 4 && p; i++) { chain.push(p.outerHTML.slice(0, 260)); p = p.parentElement; }
    return { found: true, chain, switches: document.querySelectorAll('[role="switch"],input[type="checkbox"]').length };
  })()`);
  console.log(JSON.stringify(dom, null, 2));
} finally {
  await close();
}
