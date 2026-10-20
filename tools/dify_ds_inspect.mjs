import { openDify, sleep } from './dify-lib.mjs';

const DS = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const { b, close } = await openDify(9342);
try {
  await b.goto(`http://172.17.1.46/datasets/${DS}/documents`, 6000);
  const info = await b.eval(`(() => ({
    path: location.pathname,
    buttons: [...document.querySelectorAll('button')].map(x => (x.innerText||'').trim()).filter(Boolean).slice(0, 20),
    text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0, 1200)
  }))()`);
  console.log(JSON.stringify(info, null, 2));
} finally {
  await close();
}
