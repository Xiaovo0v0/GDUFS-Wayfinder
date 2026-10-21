// 检查"本地客户端 + 在线智能体"这条组合路径：file:// 打开时能否调通 Dify。
//   node tools/check_online_from_file.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Browser } from './cdp.mjs';

const REPO = 'C:/Users/86134/Desktop/gdufs';
const ZIP = path.join(REPO, 'deliverables/尚行-本地客户端.zip');
const DIR = path.join(os.tmpdir(), 'sx_online_' + Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
execFileSync('powershell', ['-NoProfile', '-Command',
  `Expand-Archive -LiteralPath '${ZIP}' -DestinationPath '${DIR}' -Force`], { stdio: 'inherit' });

const base = 'file:///' + path.join(DIR, 'index.html').replace(/\\/g, '/');
const b = new Browser({ port: 9500, visible: false });
await b.launch(base);
await sleep(6500);

await b.eval(`(() => { const i=document.querySelector('#ai-input'); i.value='成绩单在哪办';
  i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#ai-send').click(); })()`,
  { awaitPromise: false });
await sleep(40000);

const r = JSON.parse(await b.eval(`JSON.stringify({
  badge: (document.querySelector('#ai-badge')||{}).innerText,
  msg: (document.querySelectorAll('#ai-body .msg.bot')[1]||{}).innerText?.slice(0, 120),
  sys: [...document.querySelectorAll('#ai-body .msg.sys')].map(e=>e.innerText).slice(-2)
})`, { awaitPromise: false }));

console.log(JSON.stringify(r, null, 1));
console.log(r.badge.includes('在线') ? '✅ file:// 下也能连上 Dify（CORS 放行 null origin）'
  : '⚠️ file:// 下没连上，走的是本地降级');
await b.shot(path.join(REPO, 'artifacts/3d/local_online_check.png'));
await b.close();
fs.rmSync(DIR, { recursive: true, force: true });
