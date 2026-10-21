// 验证本地客户端安装包：解压到临时目录，用 file:// 打开，检查南校 / 北校 / 离线问答。
//   node tools/verify_local_client.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Browser } from './cdp.mjs';

const REPO = 'C:/Users/86134/Desktop/gdufs';
const ZIP = path.join(REPO, 'deliverables/尚行-本地客户端.zip');
const DIR = path.join(os.tmpdir(), 'sx_local_verify_' + Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
execFileSync('powershell', ['-NoProfile', '-Command',
  `Expand-Archive -LiteralPath '${ZIP}' -DestinationPath '${DIR}' -Force`], { stdio: 'inherit' });

const files = fs.readdirSync(DIR);
console.log('解压得到：', files.join(' / '));
const entry = ['index.html', '尚行-广外校园向导.html'].find((f) => files.includes(f));
if (!entry) { console.error('找不到入口 HTML'); process.exit(1); }
const base = 'file:///' + path.join(DIR, entry).replace(/\\/g, '/');

let portSeq = 9394;
async function open(url, waitMs) {
  const b = new Browser({ port: portSeq++, visible: false });
  await b.launch(url);
  await sleep(waitMs);
  return b;
}

let ok = true;
const fail = (m) => { console.error('❌', m); ok = false; };

// 南校
{
  const b = await open(base, 7000);
  const s = JSON.parse(await b.eval(`JSON.stringify({
    mode:(window.__navDebug||{}).mode, buildings:(window.GDUFS_DATA||{buildings:[]}).buildings.length,
    services:(window.GDUFS_SERVICE||[]).length, glb: typeof window.GDUFS_GLB_URL
  })`, { awaitPromise: false }));
  console.log('南校：', JSON.stringify(s));
  if (s.mode !== 'glb') fail('南校没有加载 GLB 模型');
  if (s.buildings !== 51) fail('南校建筑数不是 51');
  if (s.services !== 40) fail('办事数据不是 40 条');
  await b.shot(path.join(REPO, 'artifacts/3d/local_verify_south.png'));
  await b.close();
  await sleep(1500);
}

// 北校 + 强制离线问答
{
  const b = await open(base + '?campus=north&ai=off', 7000);
  const s = JSON.parse(await b.eval(`JSON.stringify({
    buildings:(window.GDUFS_NORTH||{buildings:[]}).buildings.length,
    layers:Object.keys((window.GDUFS_NORTH||{}).layers||{}),
    title:(document.querySelector('#panel h1')||{}).innerText
  })`, { awaitPromise: false }));
  console.log('北校：', JSON.stringify(s));
  if (s.buildings !== 42) fail('北校建筑数不是 42');
  if (!s.layers.includes('roads')) fail('北校道路图层缺失');

  await b.eval(`(() => {
    const i=document.querySelector('#ai-input'); i.value='成绩单在哪办';
    i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#ai-send').click();
  })()`, { awaitPromise: false });
  await sleep(2500);
  const r = JSON.parse(await b.eval(`JSON.stringify({
    badge:(document.querySelector('#ai-badge')||{}).innerText,
    msg:(document.querySelectorAll('#ai-body .msg.bot')[1]||{}).innerText?.slice(0,80)
  })`, { awaitPromise: false }));
  console.log('离线问答：', JSON.stringify(r));
  if (!/离线/.test(r.badge || '')) fail('?ai=off 没有生效');
  await b.shot(path.join(REPO, 'artifacts/3d/local_verify_north.png'));
  await b.close();
}

fs.rmSync(DIR, { recursive: true, force: true });
console.log(ok ? '✅ 本地客户端可用（南校 / 北校 / 离线问答）' : '❌ 本地客户端异常');
process.exit(ok ? 0 : 1);
