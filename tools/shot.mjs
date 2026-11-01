// 通用截图：node tools/shot.mjs [选项]
//   --url  http://127.0.0.1:8080/          页面地址
//   --out  artifacts/3d/shot.png           输出文件
//   --wait 3500                            加载后等待毫秒
//   --w 1576 --h 908                       视口尺寸
//   --mobile --dpr 3                       手机模拟（触摸 + 高 DPR），配合 --w 390 --h 844
//   --js  "window.__navDebug.setPlaces('文采园','图书馆')"   截图前执行
//   --nohud                                隐藏左上/右下 HUD（只看 3D）
//   --compose                              软件渲染丢块时补洞（见下）
//
// 每次都禁用缓存并重新导航，避免改完代码还在看旧画面。
//
// ⚠ 关于 --compose：这台机器没有 GPU，Edge 和 playwright headless shell 都走
// 软件光栅，fixed 不透明浮层（#panel/#topbar 等）下方会丢块，截出来是透明像素。
// 换浏览器、换 captureScreenshot 参数都修不掉（fromSurface:false 会整页空白）。
// 唯一的做法是截两张再合成：① 正常截（浮层齐）② 用 CSS 藏掉浮层截纯场景
// ③ 在 Node 里把场景补进 ① 的透明处（tools/png.mjs）。默认会对普通截图做
// 透明像素检测并在命中时给出告警 —— 否则这种丢失是完全静默的。

import { Browser } from './cdp.mjs';
import { decodePng, countTransparent } from './png.mjs';
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
const isMobile = has('--mobile');
const compose = has('--compose');
const dpr = Number(argOf('--dpr', isMobile ? '3' : '1'));

// 所有 fixed 浮层。--compose 会临时把它们藏掉再截一张纯场景（列表在 cdp.mjs 的
// shotClean 里，这里不重复维护）。

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = new Browser({ port: 9333 });
try {
  await b.launch('about:blank');
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile: isMobile });
  if (isMobile) await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
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
    await sleep(Number(argOf('--after', '1200')));
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });

  if (compose) {
    const r = await b.shotClean(out);
    console.log(`compose: 用纯场景补掉 ${r.holes} 个透明像素（${r.size[0]}x${r.size[1]}）`);
  } else {
    await b.shot(out);
    const img = decodePng(fs.readFileSync(out));
    const holes = countTransparent(img);
    if (holes > 0) {
      const pct = ((holes / (img.width * img.height)) * 100).toFixed(2);
      console.log(`WARN 截图含 ${holes} 个透明像素（${pct}%）：软件渲染在 fixed 浮层下方丢块。加 --compose 重拍。`);
    }
  }

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
