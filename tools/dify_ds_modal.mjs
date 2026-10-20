import { openDify, sleep } from './dify-lib.mjs';

const DS = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const { b, close } = await openDify(9343);
try {
  await b.goto(`http://172.17.1.46/datasets/${DS}/documents`, 6000);
  await b.eval(`(() => { const btns=[...document.querySelectorAll('button')].filter(x=>(x.innerText||'').trim()==='添加文件'); btns[btns.length-1].click(); return btns.length; })()`, { awaitPromise: false });
  await sleep(1500);
  const modal = await b.eval(`(() => ({
    text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0, 1500),
    buttons: [...document.querySelectorAll('button')].map(x => (x.innerText||'').trim()).filter(Boolean).slice(-15)
  }))()`);
  console.log(JSON.stringify(modal, null, 2));
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/ds_add_modal.png');
} finally {
  await close();
}
