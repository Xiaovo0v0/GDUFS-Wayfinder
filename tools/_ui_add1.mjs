import { openDify } from './dify-lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { b, close } = await openDify(9384);
try {
  await b.goto('http://172.17.1.46/integrations/model-provider', 7000);
  const clicked = await b.eval(`(() => {
    const btns = [...document.querySelectorAll('button, a')];
    const target = btns.find(x => (x.innerText||'').trim() === '添加模型');
    if (!target) return 'not found: ' + btns.slice(0,15).map(x=>x.innerText.trim()).join('|');
    target.click();
    return 'clicked';
  })()`, { awaitPromise: false });
  console.log(clicked);
  await sleep(2500);
  const modal = await b.eval(`(() => {
    const dlg = document.querySelector('[role=dialog]') || document.body;
    return (dlg.innerText||'').replace(/\\s+/g,' ').slice(0, 400);
  })()`, { awaitPromise: false });
  console.log('MODAL:', modal);
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/add_model_modal.png');
} finally { await close(); }
