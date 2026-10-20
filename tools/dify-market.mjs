import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
fs.mkdirSync(OUT, { recursive: true });
const EMAIL = '20241003008@gdufs.edu.cn';
const PASS = '19876699213';
const b = new Browser({ port: 9333, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const api = async (p, opts = {}) => b.eval(`(async () => {
  try {
    const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
    const csrf = m ? decodeURIComponent(m[1]) : '';
    const o = Object.assign({}, ${JSON.stringify(opts)});
    o.headers = Object.assign({ 'x-csrf-token': csrf }, o.headers || {});
    o.credentials = 'include';
    const r = await fetch(${JSON.stringify(p)}, o);
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { j = t.slice(0,300); }
    return { status: r.status, body: j };
  } catch (e) { return { error: String(e) }; }
})()`);

async function login() {
  for (let i = 0; i < 4; i++) {
    if ((await b.eval('location.pathname')) !== '/signin') return true;
    await b.waitFor(`document.querySelector('input[name="email"]')`, 30000);
    const r = await b.eval(`(() => {
      const e=document.querySelector('input[name="email"]'), p=document.querySelector('input[name="password"]');
      if(!e||!p) return 'missing';
      const set=(el,v)=>{const pr=HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(pr,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
      set(e,${JSON.stringify(EMAIL)}); set(p,${JSON.stringify(PASS)});
      const btn=[...document.querySelectorAll('button')].find(x=>x.type==='submit'); if(!btn) return 'nobutton'; btn.click(); return 'ok';
    })()`, { awaitPromise: false });
    if (r !== 'ok') { await sleep(1500); continue; }
    if (await b.waitFor(`location.pathname !== '/signin'`, 30000)) { await sleep(3500); return true; }
  }
  return false;
}

try {
  await b.launch('http://172.17.1.46/plugins');
  await sleep(2000);
  console.log('login:', await login());
  await b.send('Network.enable');
  b.events.length = 0;

  const pages = ['/plugins', '/integrations/tools/built-in', '/integrations/model-provider'];
  const texts = {};
  for (const p of pages) {
    await b.goto('http://172.17.1.46' + p, 7000);
    texts[p] = await b.eval(`({ path: location.pathname, text: document.body.innerText.slice(0,5000) })`);
    await b.shot(`${OUT}/mx_${p.replace(/[^a-z]/gi,'')}.png`, { fullPage: true });
  }
  const reqs = b.events.filter(e => e.method === 'Network.requestWillBeSent')
    .map(e => ({ url: e.params.request.url.replace('http://172.17.1.46',''), method: e.params.request.method }))
    .filter(r => r.url.includes('/console/api/'));
  const uniq = [...new Map(reqs.map(r => [r.method + ' ' + r.url.split('?')[0], r])).values()];
  fs.writeFileSync(`${OUT}/marketplace.json`, JSON.stringify({ texts, uniq }, null, 2));
  console.log(JSON.stringify(texts, null, 2).slice(0, 6000));
  console.log('--- endpoints ---');
  console.log(uniq.map(r => r.method + ' ' + r.url).join('\n'));
} finally {
  await b.close();
}
