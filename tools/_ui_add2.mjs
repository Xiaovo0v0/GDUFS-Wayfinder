import { openDify } from './dify-lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { b, close } = await openDify(9385);
try {
  await b.goto('http://172.17.1.46/integrations/model-provider', 7000);
  await b.eval(`(() => { const t=[...document.querySelectorAll('button, a')].find(x=>x.innerText.trim()==='添加模型'); if(t) t.click(); })()`, { awaitPromise: false });
  await sleep(2500);
  const form = await b.eval(`(() => {
    const dlg = document.querySelector('[role=dialog]');
    if (!dlg) return 'no dialog';
    const out = [];
    dlg.querySelectorAll('input, select, textarea, button').forEach(el => {
      out.push({ tag: el.tagName, type: el.type||'', name: el.name||'', ph: el.placeholder||'', val: (el.value||'').slice(0,40), txt: (el.innerText||'').trim().slice(0,20), required: !!el.required });
    });
    const labels = [...dlg.querySelectorAll('label')].map(l => l.innerText.trim()).filter(Boolean);
    return JSON.stringify({ labels, controls: out });
  })()`, { awaitPromise: false });
  console.log(form);
} finally { await close(); }
