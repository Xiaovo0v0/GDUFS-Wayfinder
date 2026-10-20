import { openDify, sleep } from './dify-lib.mjs';

const DS = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const { b, close } = await openDify(9345);
try {
  await b.goto(`http://172.17.1.46/datasets/${DS}/documents/create`, 6000);
  const dom = await b.eval(`(() => {
    const el = [...document.querySelectorAll('*')].find(x => (x.innerText||'').trim() === '导入已有文本');
    if (!el) return 'nf';
    let p = el, chain = [];
    for (let i = 0; i < 5 && p; i++) { chain.push({ tag: p.tagName, cls: (p.className||'').toString().slice(0,80), role: p.getAttribute && p.getAttribute('role') }); p = p.parentElement; }
    const r = el.getBoundingClientRect();
    return { chain, rect: { x: r.x, y: r.y, w: r.width, h: r.height }, outer: el.outerHTML.slice(0, 300) };
  })()`);
  console.log(JSON.stringify(dom, null, 2));

  // 用真实鼠标点击
  if (dom.rect) {
    const x = dom.rect.x + dom.rect.w / 2, y = dom.rect.y + dom.rect.h / 2;
    await b.click(x, y);
    await sleep(1500);
    const after = await b.eval(`({ text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0, 900), textareas: document.querySelectorAll('textarea').length, editables: document.querySelectorAll('[contenteditable="true"]').length })`);
    console.log(JSON.stringify(after, null, 2));
    await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/ds_text_mode.png');
  }
} finally {
  await close();
}
