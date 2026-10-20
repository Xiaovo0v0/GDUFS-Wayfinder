import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
fs.mkdirSync(OUT, { recursive: true });
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

// click element whose trimmed text equals or contains given text
const clickText = async (tag, text, exact = false) => b.eval(`(() => {
  const els=[...document.querySelectorAll(${JSON.stringify(tag)})];
  const t=${JSON.stringify(text)};
  const el=els.find(e=>{const s=(e.innerText||e.textContent||'').trim(); return ${exact ? 's===t' : 's.includes(t)'};});
  if(!el) return 'notfound';
  el.scrollIntoView({block:'center'}); el.click(); return 'clicked:'+(el.innerText||'').trim().slice(0,40);
})()`, { awaitPromise: false });

try {
  await b.launch('http://172.17.1.46/apps');
  await sleep(2000);
  console.log('login', await login());

  // 1) app creation dialog
  await b.goto('http://172.17.1.46/apps', 4000);
  const btn = await clickText('button', '创建空白应用');
  await sleep(1800);
  const dlg = await b.eval(`document.body.innerText.slice(0,1800)`);
  await b.shot(`${OUT}/10_create_app_dialog.png`);
  console.log('create dialog click:', btn);
  console.log(dlg.slice(0, 900));

  // 2) routes on integrations
  await b.goto('http://172.17.1.46/integrations/tools/built-in', 5000);
  const hrefs = await b.eval(`[...document.querySelectorAll('a[href*="integrations"]')].map(a=>a.getAttribute('href'))`);
  console.log('integration routes:', JSON.stringify([...new Set(hrefs)]));

  fs.writeFileSync(`${OUT}/tour-step1.json`, JSON.stringify({ dlg, hrefs }, null, 2));
} finally {
  await b.close();
}
