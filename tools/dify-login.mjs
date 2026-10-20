import { Browser } from './cdp.mjs';

const EMAIL = '20241003008@gdufs.edu.cn';
const PASS = '19876699213';

const b = new Browser({ port: 9333, visible: false });
try {
  await b.launch('http://172.17.1.46/signin');
  await b.waitFor(`document.querySelector('input[name="email"]')`, 30000);
  await b.type('input[name="email"]', EMAIL);
  await b.type('input[name="password"]', PASS);
  await new Promise((r) => setTimeout(r, 300));
  await b.eval(`(() => { const bs=[...document.querySelectorAll('button')].filter(x=>x.type==='submit'); bs[0]?.click(); return bs.length; })()`, { awaitPromise: false });
  const ok = await b.waitFor(`location.pathname !== '/signin'`, 30000);
  await new Promise((r) => setTimeout(r, 3000));
  const state = await b.eval(`({ url: location.href, path: location.pathname, body: document.body.innerText.slice(0,600) })`);
  console.log(JSON.stringify({ ok, ...state }, null, 2));
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/01_after_login.png', { fullPage: true });
} finally {
  await b.close();
}
