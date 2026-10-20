import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const EMAIL = '20241003008@gdufs.edu.cn';
const PASS = '19876699213';
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

  // app creation dialog: list buttons
  await b.goto('http://172.17.1.46/apps', 4500);
  const btns = await b.eval(`[...document.querySelectorAll('button')].map(x=>(x.innerText||'').trim()).filter(Boolean).slice(0,15)`);
  console.log('buttons:', JSON.stringify(btns));
  const r = await b.eval(`(() => { const el=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='创建'); if(!el) return 'nf'; el.click(); return 'ok'; })()`, { awaitPromise: false });
  await sleep(1500);
  const dlgText = await b.eval(`document.body.innerText.slice(0,1400)`);
  await b.shot(`${OUT}/10_create_app_dialog.png`);
  console.log('click:', r, '\n---\n', dlgText.slice(0, 800));

  // integration sub pages
  const pages = {
    mcp: '/integrations/tools/mcp',
    api: '/integrations/tools/api',
    wf: '/integrations/tools/workflow',
    datasource: '/integrations/data-source',
    trigger: '/integrations/trigger',
    agentstrategy: '/integrations/agent-strategy',
    extension: '/integrations/extension',
  };
  const texts = {};
  for (const [k, p] of Object.entries(pages)) {
    await b.goto('http://172.17.1.46' + p, 3500);
    texts[k] = await b.eval(`({ path: location.pathname, text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,2500) })`);
    await b.shot(`${OUT}/int_${k}.png`, { fullPage: true });
  }
  fs.writeFileSync(`${OUT}/integrations.json`, JSON.stringify({ btns, dlgText, texts }, null, 2));
  for (const [k, v] of Object.entries(texts)) console.log(`\n===== ${k} (${v.path}) =====\n${v.text.slice(0, 900)}`);
} finally {
  await b.close();
}
