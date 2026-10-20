import { Browser } from './cdp.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 用全新 profile（无 cookie）访问 WebApp，验证评委在内网不登录能否直接打开
const profile = path.join(os.tmpdir(), 'dify-anon-' + Date.now());
const b = new Browser({ port: 9391, visible: false, profile });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('http://172.17.1.46/chat/xbhUki5mY7mJRfux');
  await sleep(8000);
  const info = await b.eval(`({
    url: location.href,
    title: document.title,
    loggedIn: !!document.cookie.match(/access_token|csrf/),
    text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0, 500),
    hasInput: !!document.querySelector('textarea, input[type=text]')
  })`);
  console.log(JSON.stringify(info, null, 2));
  fs.mkdirSync('C:/Users/86134/Desktop/gdufs/artifacts/dify', { recursive: true });
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/webapp_anon.png');
} finally {
  await b.close();
}
