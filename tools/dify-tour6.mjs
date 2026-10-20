import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const EMAIL = '20241003008@gdufs.edu.cn';
const PASS = '19876699213';
const CHATFLOW = '19d80042-8b75-49ad-a01f-62b8a33fc0d4';
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
  await b.goto(`http://172.17.1.46/app/` + CHATFLOW + '/access-point', 6000);

  const click = async (text) => b.eval(`(() => { const el=[...document.querySelectorAll('button,a,div[role="tab"]')].find(x=>(x.innerText||'').trim()===${JSON.stringify(text)}); if(!el) return 'nf'; el.click(); return 'ok'; })()`, { awaitPromise: false });

  const res = {};
  for (const t of ['嵌入网站', '自定义前端']) {
    const c = await click(t);
    await sleep(2500);
    res[t] = { click: c, text: await b.eval(`document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,3000)`) };
    await b.shot(`${OUT}/42_embed_${t}.png`, { fullPage: true });
    console.log(`\n=== ${t} (${c}) ===\n`, res[t].text.slice(0, 1500));
  }
  fs.writeFileSync(`${OUT}/embed.json`, JSON.stringify(res, null, 2));
} finally {
  await b.close();
}
