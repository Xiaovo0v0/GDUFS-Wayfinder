import { Browser } from './cdp.mjs';
import os from 'node:os';
import path from 'node:path';

const profile = path.join(os.tmpdir(), 'dify-anon2-' + Date.now());
const b = new Browser({ port: 9392, visible: false, profile });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('about:blank');
  await b.send('Network.enable');
  await b.send('Runtime.enable');
  await b.send('Log.enable');
  await b.goto('http://172.17.1.46/chat/xbhUki5mY7mJRfux', 20000);
  await sleep(6000);
  const info = await b.eval(`({
    url: location.href,
    title: document.title,
    text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0, 400),
    inputs: document.querySelectorAll('textarea,input').length,
    cookie: document.cookie.slice(0, 200)
  })`);
  console.log(JSON.stringify(info, null, 2));
  const reqs = b.events.filter((e) => e.method === 'Network.responseReceived').map((e) => `${e.params.response.status} ${e.params.response.url.replace('http://172.17.1.46', '').slice(0, 80)}`);
  console.log('responses:', JSON.stringify(reqs.slice(-12), null, 1));
  const errs = b.events.filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error').map((e) => e.params.entry.text.slice(0, 160));
  console.log('errors:', JSON.stringify(errs.slice(0, 5), null, 1));
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/webapp_anon2.png');
} finally {
  await b.close();
}
