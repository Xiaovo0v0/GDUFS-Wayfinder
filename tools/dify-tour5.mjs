import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const EMAIL = '20241003008@gdufs.edu.cn';
const PASS = '19876699213';
const CHATFLOW = '19d80042-8b75-49ad-a01f-62b8a33fc0d4';
const DS = '01de9f18-c465-47d6-8b36-9d4a5267efa3';
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

  await b.goto(`http://172.17.1.46/app/` + CHATFLOW + '/overview', 5000);
  const links = await b.eval(`[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>h&&h.includes('app/'))`);
  console.log('app links:', JSON.stringify([...new Set(links)]));

  // click 访问点
  await b.eval(`(() => { const el=[...document.querySelectorAll('a,button')].find(x=>(x.innerText||'').trim()==='访问点'); if(!el) return 'nf'; el.click(); return 'ok'; })()`, { awaitPromise: false });
  await sleep(4000);
  const ap = await b.eval(`({ path: location.pathname, text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,3500) })`);
  await b.shot(`${OUT}/41_access_point.png`, { fullPage: true });
  console.log('\n=== access point ===\n', ap.path, '\n', ap.text.slice(0, 2000));

  // dataset detail + settings
  await b.goto(`http://172.17.1.46/datasets/` + DS + '/documents', 5000);
  const dsText = await b.eval(`({ path: location.pathname, text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,2500) })`);
  await b.shot(`${OUT}/31_dataset_docs.png`, { fullPage: true });
  console.log('\n=== dataset ===\n', dsText.text.slice(0, 1200));

  // settings page of dataset (index/retrieval)
  await b.goto(`http://172.17.1.46/datasets/` + DS + '/settings', 5000);
  const st = await b.eval(`({ path: location.pathname, text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,3000) })`);
  await b.shot(`${OUT}/32_dataset_settings.png`, { fullPage: true });
  console.log('\n=== dataset settings ===\n', st.path, '\n', st.text.slice(0, 1500));

  // agents + skills
  for (const p of ['/agents', '/skills']) {
    await b.goto('http://172.17.1.46' + p, 5000);
    const t = await b.eval(`({ path: location.pathname, text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,2000) })`);
    console.log(`\n=== ${p} (${t.path}) ===\n`, t.text.slice(0, 1000));
    await b.shot(`${OUT}/50_${p.replace(/\W/g,'')}.png`, { fullPage: true });
  }

  fs.writeFileSync(`${OUT}/access.json`, JSON.stringify({ links, ap, dsText, st }, null, 2));
} finally {
  await b.close();
}
