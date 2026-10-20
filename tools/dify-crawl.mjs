import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
fs.mkdirSync(OUT, { recursive: true });
const EMAIL = '20241003008@gdufs.edu.cn';
const PASS = '19876699213';

const b = new Browser({ port: 9333, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await b.launch('http://172.17.1.46/signin');
  await b.waitFor(`document.querySelector('input[name="email"]')`, 40000);
  await b.type('input[name="email"]', EMAIL);
  await b.type('input[name="password"]', PASS);
  await sleep(300);
  await b.eval(`[...document.querySelectorAll('button')].filter(x=>x.type==='submit')[0]?.click()`, { awaitPromise: false });
  await b.waitFor(`location.pathname !== '/signin'`, 40000);
  await sleep(4000);
  console.log('after login:', await b.eval('location.pathname'));

  await b.send('Network.enable');
  b.events.length = 0;

  const pages = ['/', '/apps', '/datasets', '/tools', '/plugins', '/settings'];
  const texts = {};
  for (const p of pages) {
    await b.goto('http://172.17.1.46' + p, 6000);
    const info = await b.eval(`({ path: location.pathname, text: document.body.innerText.slice(0, 4000) })`);
    texts[p] = info;
    await b.shot(`${OUT}/page_${p.replace(/[^a-z]/gi, '') || 'home'}.png`, { fullPage: true });
  }

  const reqs = b.events.filter((e) => e.method === 'Network.requestWillBeSent')
    .map((e) => ({ url: e.params.request.url.replace('http://172.17.1.46', ''), method: e.params.request.method }))
    .filter((r) => r.url.includes('/console/api/'));
  const uniq = [...new Map(reqs.map((r) => [r.method + ' ' + r.url, r])).values()];

  fs.writeFileSync(`${OUT}/crawl.json`, JSON.stringify({ texts, uniq }, null, 2));
  console.log(JSON.stringify({ pages: Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, v.path])), endpointCount: uniq.length }, null, 2));
  console.log(uniq.map((r) => r.method + ' ' + r.url).join('\n'));
} finally {
  await b.close();
}
