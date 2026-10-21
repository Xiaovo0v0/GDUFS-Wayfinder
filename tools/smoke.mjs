// 回归闸门：每次改完前端跑一次
//   node tools/smoke.mjs            本地 http://127.0.0.1:8080/
//   node tools/smoke.mjs --port 8081
//   node tools/smoke.mjs --ai       额外跑一次真实 Dify 问答（慢，约 10s）
//
// 退出码 0 = 全绿；1 = 有失败项。

import { Browser } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = argOf('--port', '8080');
const WITH_AI = args.includes('--ai');
// 固定中文，避免浏览器 localStorage 里的语言偏好影响断言
const BASE = `http://127.0.0.1:${PORT}/?lang=zh`;
const SHOT_DIR = 'artifacts/smoke';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${name}${detail ? ' — ' + detail : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = new Browser({ port: 9333 });
try {
  console.log(`\n冒烟测试 ${BASE}\n`);
  await browser.launch(BASE);
  await sleep(1500);

  // 1. 页面与渲染器
  const canvas = await browser.eval('!!document.querySelector("#app canvas")');
  check('页面加载出 WebGL canvas', !!canvas);

  const exceptions = browser.events.filter((e) => e.method === 'Runtime.exceptionThrown');
  check('无未捕获异常', exceptions.length === 0,
    exceptions.length ? String(exceptions[0].params?.exceptionDetails?.exception?.description || exceptions[0].params?.exceptionDetails?.text).slice(0, 200) : '');

  // 2. 场景与模型
  const mode = await browser.eval('window.__navDebug && window.__navDebug.mode');
  check('GLB 模型已加载（http 环境）', mode === 'glb', 'mode=' + mode);

  const nb = await browser.eval('window.GDUFS_DATA ? window.GDUFS_DATA.buildings.length : 0');
  check('建筑数据存在', nb >= 50, nb + ' 栋');

  // 3. 算路
  const r = await browser.eval(`JSON.stringify(window.__navDebug.setPlaces('文采园','图书馆'))`);
  const parsed = JSON.parse(r || '{}');
  check('起点/终点可解析', !!(parsed.from && parsed.to), `${parsed.from} → ${parsed.to}`);

  await sleep(400);
  const status = await browser.eval('document.querySelector("#status").innerText');
  const m = /(\d{2,4})\s*米/.exec(status || '');
  check('路线距离已算出', !!m, m ? m[0] : (status || '').slice(0, 40));

  // 4. 建筑信息卡
  await browser.eval('window.__onBuildingClick && window.__onBuildingClick(window.GDUFS_DATA.buildings[0])', { awaitPromise: false });
  await sleep(300);
  const cardShown = await browser.eval(`!document.querySelector('#bcard').classList.contains('hidden')`);
  const cardName = await browser.eval(`document.querySelector('#bcard-name') ? document.querySelector('#bcard-name').innerText : ''`);
  check('点击建筑弹出信息卡', !!cardShown, cardName);

  // 5. 布局：无横向溢出
  const overflow = await browser.eval('document.documentElement.scrollWidth - window.innerWidth');
  check('无横向溢出', overflow <= 2, 'overflow=' + overflow + 'px');

  // 6. 第一人称漫游：进入→相机降到人眼高度，退出→恢复
  const walkOk = await browser.eval(`(() => {
    window.__navDebug.setPlaces('文采园','图书馆');
    return window.__walk ? window.__walk.start() : false;
  })()`, { awaitPromise: false });
  await sleep(900);
  const eyeY = await browser.eval('window.__navDebug.camera.position.y');
  check('漫游进入后相机降到人眼高度', walkOk && eyeY > 0.8 && eyeY < 3, 'y=' + (eyeY || 0).toFixed(2) + 'm');

  await browser.eval('window.__walk.stop()', { awaitPromise: false });
  await sleep(300);
  const backY = await browser.eval('window.__navDebug.camera.position.y');
  check('漫游退出后相机复位', backY > 50, 'y=' + (backY || 0).toFixed(0) + 'm');

  // 6. AI 面板（可选，真实调用 Dify）
  if (WITH_AI) {
    await browser.eval(`document.querySelector('#bcard').classList.add('hidden')`, { awaitPromise: false });
    await browser.eval(`(() => { const i=document.querySelector('#ai-input'); i.value='从文采园怎么去图书馆'; i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#ai-send').click(); })()`, { awaitPromise: false });
    const got = await browser.waitFor(`document.querySelectorAll('#ai-body .msg.bot').length > 0`, 30000);
    const badge = await browser.eval(`document.querySelector('#ai-badge') ? document.querySelector('#ai-badge').innerText : ''`);
    check('AI 问答返回', !!got, '通道：' + badge);
  }

  // 截图存档
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const shot = path.join(SHOT_DIR, 'smoke.png');
  await browser.shot(shot);
  console.log(`\n  截图：${shot}`);
} catch (err) {
  check('冒烟脚本自身未崩溃', false, String(err.message).slice(0, 120));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
