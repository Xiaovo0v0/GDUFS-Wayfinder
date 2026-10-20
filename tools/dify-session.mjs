import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
fs.mkdirSync(OUT, { recursive: true });
const EMAIL = '20241003008@gdufs.edu.cn';
const PASS = '19876699213';

const b = new Browser({ port: 9333, visible: false });

async function ensureLogin() {
  await b.goto('http://172.17.1.46/apps', 4000);
  const p = await b.eval('location.pathname');
  if (p.startsWith('/signin') || p.startsWith('/reset-password')) {
    await b.goto('http://172.17.1.46/signin', 3000);
    await b.waitFor(`document.querySelector('input[name="email"]')`, 30000);
    await b.type('input[name="email"]', EMAIL);
    await b.type('input[name="password"]', PASS);
    await new Promise((r) => setTimeout(r, 300));
    await b.eval(`(() => { const bs=[...document.querySelectorAll('button')].filter(x=>x.type==='submit'); bs[0]?.click(); return bs.length; })()`, { awaitPromise: false });
    await b.waitFor(`location.pathname !== '/signin'`, 30000);
    await new Promise((r) => setTimeout(r, 3000));
    return { relogged: true, path: await b.eval('location.pathname') };
  }
  return { relogged: false, path: p };
}

try {
  await b.launch('http://172.17.1.46/apps');
  const lg = await ensureLogin();
  const storage = await b.eval(`(() => {
    const ls = {}; for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); ls[k]=(localStorage.getItem(k)||'').slice(0,60); }
    return { ls, cookie: document.cookie.slice(0,500) };
  })()`);
  console.log(JSON.stringify({ lg, storage }, null, 2));
} finally {
  await b.close();
}
