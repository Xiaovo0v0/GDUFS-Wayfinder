import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const EMAIL = '20241003008@gdufs.edu.cn';
const PASS = '19876699213';
const WF = '45f6da5d-27d7-47b7-adbf-847ff2e1033d';
const CHATFLOW = '19d80042-8b75-49ad-a01f-62b8a33fc0d4'; // 学习辅导
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

  await b.goto(`http://172.17.1.46/app/` + WF + '/workflow', 8000);
  await b.eval(`(() => { const el=document.querySelector('[aria-label="添加节点"]'); if(el){el.click(); return 'ok';} return 'nf'; })()`, { awaitPromise: false });
  await sleep(1500);
  const palette = await b.eval(`document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,4000)`);
  await b.shot(`${OUT}/21_node_palette.png`);
  console.log('=== palette ===\n', palette.slice(0, 2500));

  // publish dialog
  await b.eval(`(() => { const el=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='发布'); if(el){el.click(); return 'ok';} return 'nf'; })()`, { awaitPromise: false });
  await sleep(1500);
  const pub = await b.eval(`document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,2500)`);
  await b.shot(`${OUT}/22_publish_dialog.png`);
  console.log('\n=== publish ===\n', pub.slice(0, 1500));

  // app overview (embed / API)
  await b.goto(`http://172.17.1.46/app/` + CHATFLOW + '/overview', 6000);
  const ov = await b.eval(`({ path: location.pathname, text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,3000) })`);
  await b.shot(`${OUT}/40_app_overview.png`, { fullPage: true });
  console.log('\n=== overview ===\n', ov.text.slice(0, 1600));

  fs.writeFileSync(`${OUT}/palette.json`, JSON.stringify({ palette, pub, ov }, null, 2));
} finally {
  await b.close();
}
