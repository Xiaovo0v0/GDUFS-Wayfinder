// 模拟"智能体不可用"：在浏览器层把 Dify 域名全部拦掉，看前端是否优雅降级。
//   node tools/check_fallback.mjs
import path from 'node:path';
import { Browser } from './cdp.mjs';

const REPO = 'C:/Users/86134/Desktop/gdufs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = new Browser({ port: 9700, visible: false });
await b.launch('http://127.0.0.1:8080/?lang=zh');
await sleep(6000);

// 把 Dify 全部请求打掉
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*172.17.1.46*'] });
console.log('已拦截对 172.17.1.46 的所有请求');

await b.eval(`(() => { const i=document.querySelector('#ai-input'); i.value='成绩单在哪办';
  i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#ai-send').click(); })()`,
  { awaitPromise: false });
await sleep(8000);

const r = JSON.parse(await b.eval(`JSON.stringify({
  badge: (document.querySelector('#ai-badge')||{}).innerText,
  msg: (document.querySelectorAll('#ai-body .msg.bot')[1]||{}).innerText?.slice(0, 120)
})`, { awaitPromise: false }));

console.log(JSON.stringify(r, null, 1));
const ok = /离线/.test(r.badge) && /教务部|考务科/.test(r.msg || '');
console.log(ok ? '✅ 智能体不可用时自动降级，界面仍能回答' : '❌ 降级失败');
await b.shot(path.join(REPO, 'artifacts/3d/fallback_check.png'));
await b.close();
process.exit(ok ? 0 : 1);
