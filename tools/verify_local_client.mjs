// 本地客户端验收：解压安装包 → 用 file:// 打开 → 逐条跑「评委 3 分钟验收」的每一项。
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

let port = 9400;
let ok = true;
const fail = (m) => { console.error('   ❌ ' + m); ok = false; };
const pass = (m) => console.log('   ✅ ' + m);

async function withPage(url, waitMs, fn) {
  let b = null;
  for (let attempt = 0; attempt < 4 && !b; attempt++) {
    const portNow = port++;
    try {
      b = new Browser({ port: portNow, visible: false });
      await b.launch(url);
    } catch (e) {
      b = null;
      await sleep(2000);
    }
  }
  if (!b) { fail('浏览器起不来：' + url); return; }
  await sleep(waitMs);
  try { await fn(b); } finally { await b.close(); await sleep(2000); }
}

const ev = (b, expr, awaitPromise = false) => b.eval(expr, { awaitPromise }).then((s) => JSON.parse(s));

console.log('\n【1】南校首页');
await withPage(base + '?lang=zh', 7000, async (b) => {
  const s = await ev(b, `JSON.stringify({
    mode:(window.__navDebug||{}).mode, buildings:(window.GDUFS_DATA||{buildings:[]}).buildings.length,
    trees:(window.__navDebug||{}).treeCount, services:(window.GDUFS_SERVICE||[]).length,
    glb: typeof window.GDUFS_GLB_URL, three: typeof window.THREE
  })`);
  console.log('   ', JSON.stringify(s));
  s.mode === 'glb' ? pass('GLB 模型已加载（file:// 下）') : fail('模型未加载，mode=' + s.mode);
  s.buildings === 52 ? pass('南校 52 条（51 栋 + 八角楼）') : fail('建筑数 ' + s.buildings);
  s.services === 40 ? pass('办事数据 40 条') : fail('办事数据 ' + s.services);
  s.trees > 500 ? pass('行道树 ' + s.trees + ' 棵') : fail('树太少');
  await b.shot(path.join(REPO, 'artifacts/3d/local_verify_south.png'));
});

console.log('\n【2】路线规划');
await withPage(base + '?lang=zh', 7000, async (b) => {
  const s = await ev(b, `(() => {
    window.__navDebug.setPlaces('文采园（第一饭堂）','图书馆');
    return JSON.stringify({ dist: Math.round(window.__lastRouteDist||0), pts:(window.__lastRoute||[]).length,
      status: document.querySelector('#status').innerText.replace(/\\s+/g,' ').slice(0,50) });
  })()`);
  console.log('   ', JSON.stringify(s));
  Math.abs(s.dist - 820) < 30 ? pass('算路 ' + s.dist + ' 米') : fail('算路距离异常 ' + s.dist);
  s.pts > 15 ? pass('折线 ' + s.pts + ' 个点') : fail('折线点太少');
});

console.log('\n【3】第一人称漫游');
await withPage(base + '?lang=zh', 7000, async (b) => {
  const s = await ev(b, `(async () => {
    window.__navDebug.setPlaces('文采园（第一饭堂）','图书馆');
    await new Promise(r => setTimeout(r, 500));
    window.__walk.start();
    await new Promise(r => setTimeout(r, 1500));
    const on = window.__walk.isOn();
    const bar = !!document.querySelector('#walkbar');
    window.__walk.stop();
    return JSON.stringify({ on, bar });
  })()`, true);
  console.log('   ', JSON.stringify(s));
  s.on ? pass('漫游可启动') : fail('漫游没启动');
});

console.log('\n【4】英文界面');
await withPage(base + '?lang=en', 7000, async (b) => {
  const s = await ev(b, `JSON.stringify({ title:(document.querySelector('#panel h1')||{}).innerText,
    from:(document.querySelector('.row label')||{}).innerText, lang: document.documentElement.lang })`);
  console.log('   ', JSON.stringify(s));
  s.title === 'GDUFS Campus Guide' ? pass('面板标题英文') : fail('标题仍是 ' + s.title);
  s.from === 'From' ? pass('表单标签英文') : fail('标签仍是 ' + s.from);
});

console.log('\n【5】北校 + 强制离线');
await withPage(base + '?campus=north&ai=off', 7000, async (b) => {
  const s = await ev(b, `JSON.stringify({
    mode:(window.__navDebug||{}).mode,
    buildings:(window.GDUFS_NORTH||{buildings:[]}).buildings.length,
    layers:Object.keys((window.GDUFS_NORTH||{}).layers||{}) })`);
  s.mode === 'glb' ? pass('北校 LOD2 模型已加载') : fail('北校仍是程序化体块 mode=' + s.mode);
  console.log('   ', JSON.stringify(s));
  s.buildings === 42 ? pass('北校 42 栋') : fail('北校建筑数 ' + s.buildings);
  s.layers.includes('roads') ? pass('道路图层（data URI）') : fail('道路图层缺失');

  await b.eval(`(() => { const i=document.querySelector('#ai-input'); i.value='成绩单在哪办';
    i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#ai-send').click(); })()`, { awaitPromise: false });
  await sleep(2500);
  const r = await ev(b, `JSON.stringify({ badge:(document.querySelector('#ai-badge')||{}).innerText,
    msg:(document.querySelectorAll('#ai-body .msg.bot')[1]||{}).innerText?.slice(0,70) })`);
  console.log('   ', JSON.stringify(r));
  /离线/.test(r.badge) ? pass('?ai=off 生效') : fail('离线徽章没出现');
  /行政楼/.test(r.msg || '') ? pass('离线问答按北校给地点') : fail('离线回答不对：' + r.msg);
  await b.shot(path.join(REPO, 'artifacts/3d/local_verify_north.png'));
});

fs.rmSync(DIR, { recursive: true, force: true });
console.log('\n' + (ok ? '✅ 全部通过：本地客户端可以直接交给评委' : '❌ 有项目未通过，见上面'));
process.exit(ok ? 0 : 1);
