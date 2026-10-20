// 通用截图：node tools/shot.mjs [选项]
//   --url  http://127.0.0.1:8080/          页面地址
//   --out  artifacts/3d/shot.png           输出文件
//   --wait 3500                            加载后等待毫秒
//   --w 1576 --h 908                       视口尺寸
//   --js  "window.__navDebug.setPlaces('文采园','图书馆')"   截图前执行
//   --nohud                                隐藏左上/右下 HUD（只看 3D）
//
// 每次都禁用缓存并重新导航，避免改完代码还在看旧画面。

import { Browser } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const has = (k) => args.includes(k);

const url = argOf('--url', 'http://127.0.0.1:8080/');
const out = argOf('--out', 'artifacts/3d/shot.png');
const wait = Number(argOf('--wait', '3500'));
const W = Number(argOf('--w', '1576'));
const H = Number(argOf('--h', '908'));
const jsBefore = argOf('--js', '');
const noHud = has('--nohud');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = new Browser({ port: 9333 });
try {
  await b.launch('about:blank');
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await b.send('Page.navigate', { url });
  await sleep(400);
  // 硬刷新，确保拿到新脚本
  await b.send('Page.reload', { ignoreCache: true });
  await sleep(wait);

  if (noHud) {
    await b.eval(`(() => {
      for (const s of ['#panel','#ai','#bcard','#compass']) {
        const el = document.querySelector(s); if (el) el.style.display = 'none';
      }
      const l = document.querySelector('#labels'); if (l) l.style.display = 'none';
    })()`, { awaitPromise: false });
  }

  if (jsBefore) {
    await b.eval(jsBefore, { awaitPromise: false });
    await sleep(1200);
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  await b.shot(out);

  const evalExpr = argOf('--eval', '');
  if (evalExpr) {
    const v = await b.eval(evalExpr);
    console.log('EVAL: ' + (typeof v === 'string' ? v : JSON.stringify(v)));
  }

  const info = await b.eval(`JSON.stringify({
    mode: window.__navDebug && window.__navDebug.mode,
    trees: window.__navDebug && window.__navDebug.treeCount,
    fog: !!(window.__navDebug && window.__navDebug.scene && window.__navDebug.scene.fog),
    fogNear: window.__navDebug && window.__navDebug.scene && window.__navDebug.scene.fog ? Math.round(window.__navDebug.scene.fog.near) : null,
    fogFar: window.__navDebug && window.__navDebug.scene && window.__navDebug.scene.fog ? Math.round(window.__navDebug.scene.fog.far) : null
  })`);
  console.log(out + '  ' + info);
} finally {
  await b.close();
}
