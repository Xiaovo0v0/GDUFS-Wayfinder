import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const KEY = fs.readFileSync('C:/Users/86134/Desktop/gdufs/artifacts/dify/api-key.txt', 'utf8').trim();
const b = new Browser({ port: 9366, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html');
  await sleep(3000);
  console.log('page url:', await b.eval('location.href'));
  const r = await b.eval(`(async () => {
    try {
      const res = await fetch('http://172.17.1.46/v1/chat-messages', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ${KEY}', 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: {}, query: '你好', response_mode: 'blocking', user: 'cors-test' })
      });
      const t = await res.text();
      return { ok: true, status: res.status, acao: res.headers.get('access-control-allow-origin'), body: t.slice(0, 120) };
    } catch (e) { return { ok: false, err: String(e) }; }
  })()`);
  console.log(JSON.stringify(r, null, 2));
} finally {
  await b.close();
}
