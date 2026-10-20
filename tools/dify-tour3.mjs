import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const EMAIL = '20241003008@gdufs.edu.cn';
const PASS = '19876699213';
const WF = '45f6da5d-27d7-47b7-adbf-847ff2e1033d'; // 工作流 333
const b = new Browser({ port: 9333, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  for (let i = 0; i < 4; i++) {
    if ((await b.eval('location.pathname')) !== '/signin') return true;
    await b.waitFor(`document.querySelector('input[name="email"]')`, 30000);
    const r = await b.eval(`(() => {
      const e=document.querySelector('input[name="email"]'), p=document.querySelector('input[name="password"]');
      if(!e||!p) return 'missing';
      const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
      set(e,${JSON.stringify(EMAIL)}); set(p,${JSON.stringify(PASS)});
      const btn=[...document.querySelectorAll('button')].find(x=>x.type==='submit'); if(!btn) return 'nobutton'; btn.click(); return 'ok';
    })()`, { awaitPromise: false });
    if (r !== 'ok') { await sleep(1500); continue; }
    if (await b.waitFor(`location.pathname !== '/signin'`, 30000)) { await sleep(3500); return true; }
  }
  return false;
}

try {
  await b.launch('http://172.17.1.46/apps');
  await sleep(2000);
  await login();

  // workflow editor
  await b.goto(`http://172.17.1.46/app/` + WF + '/workflow', 8000);
  const wfText = await b.eval(`document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,2500)`);
  await b.shot(`${OUT}/20_workflow_editor.png`);
  console.log('=== workflow editor ===\n', wfText.slice(0, 1200));

  // try open node palette: click the first "+" / block-add button
  const addBtns = await b.eval(`[...document.querySelectorAll('[data-testid],button,[role="button"]')].map(e=>({t:(e.innerText||'').trim().slice(0,20), tid:e.getAttribute('data-testid'), aria:e.getAttribute('aria-label')})).filter(x=>x.tid||x.aria).slice(0,40)`);
  console.log('tagged els:', JSON.stringify(addBtns));

  // knowledge base create page
  await b.goto('http://172.17.1.46/datasets/create', 5000);
  const kbText = await b.eval(`document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,3000)`);
  await b.shot(`${OUT}/30_dataset_create.png`, { fullPage: true });
  console.log('\n=== dataset create ===\n', kbText.slice(0, 1500));

  fs.writeFileSync(`${OUT}/editor.json`, JSON.stringify({ wfText, addBtns, kbText }, null, 2));
} finally {
  await b.close();
}
