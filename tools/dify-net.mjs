import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const b = new Browser({ port: 9333, visible: false });
try {
  await b.launch('http://172.17.1.46/apps');
  await new Promise((r) => setTimeout(r, 3000));
  const ss = await b.eval(`(() => { const o={}; for (let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i); o[k]=(sessionStorage.getItem(k)||'').slice(0,80);} return o; })()`);
  console.log('sessionStorage', JSON.stringify(ss));
  await b.send('Network.enable');
  b.events.length = 0;
  await b.goto('http://172.17.1.46/apps', 5000);
  const reqs = b.events.filter((e) => e.method === 'Network.requestWillBeSent')
    .map((e) => ({ url: e.params.request.url, method: e.params.request.method, headers: e.params.request.headers }))
    .filter((r) => r.url.includes('/console/api/') || r.url.includes('/api/'));
  console.log(JSON.stringify(reqs.slice(0, 8), null, 2));
  fs.writeFileSync(`${OUT}/network.json`, JSON.stringify(reqs, null, 2));
} finally {
  await b.close();
}
