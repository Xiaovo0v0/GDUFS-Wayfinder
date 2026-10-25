// 手机端适配验收：多尺寸截图 + 布局几何断言
//   node tools/mobile_check.mjs [--url http://127.0.0.1:8080/index.html]
// 输出：artifacts/mobile/*.png，以及 PASS/FAIL 清单
//
// 检查的是「有没有被裁掉 / 有没有横向溢出 / 各浮层是否互相压住」，
// 不依赖像素比对，改样式后重跑即可。

import { Browser } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const URL = argOf('--url', 'http://127.0.0.1:8080/index.html');
const OUT = 'artifacts/mobile';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

const fails = [];
function check(cond, msg) {
  console.log((cond ? '  PASS ' : '  FAIL ') + msg);
  if (!cond) fails.push(msg);
}

const b = new Browser({ port: 9335 });
const geoExpr = `JSON.stringify((() => {
  const R = (s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
             b: Math.round(r.bottom), r: Math.round(r.right), disp: cs.display, vis: !!(e.offsetWidth || e.offsetHeight) };
  };
  const sc = document.querySelector('#panel .panel-scroll');
  return {
    vw: innerWidth, vh: innerHeight,
    sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
    panel: R('#panel'), dock: R('#dock'), topbar: R('#topbar'), compass: R('#compass'),
    ai: R('#ai'), bcard: R('#bcard'), walkbar: R('#walkbar'), toggle: R('#panelToggle'),
    legend: R('.panel-extra'), status: R('#status'), aiInput: R('.ai-input'),
    collapse: R('#panelCollapse'), head: R('#panelHead'), mini: R('#miniSummary'),
    collapsed: document.querySelector('#panel').classList.contains('collapsed'),
    miniText: (document.querySelector('#miniSummary') || {}).textContent || '',
    scroll: sc ? { disp: getComputedStyle(sc).display, sh: sc.scrollHeight, ch: sc.clientHeight } : null,
    aiOpen: document.body.classList.contains('ai-open')
  };
})())`;

async function setViewport(w, h, dpr = 3) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: true });
}
async function go(search = '?lang=zh', wait = 3200) {
  await b.send('Page.navigate', { url: URL + search });
  await sleep(500);
  await b.send('Page.reload', { ignoreCache: true });
  await sleep(wait);
}
async function geo() { return JSON.parse(await b.eval(geoExpr)); }
async function shot(name) { await b.shot(path.join(OUT, name)); console.log('  shot ' + name); }

function noHoriz(g, tag) {
  check(g.sw <= g.vw, tag + ' 无横向溢出 (scrollWidth=' + g.sw + ' / vw=' + g.vw + ')');
}
function inViewport(g, tag) {
  const els = ['panel', 'topbar', 'compass', 'ai', 'walkbar'];
  for (const k of els) {
    const r = g[k];
    if (!r || !r.vis) continue;
    check(r.x >= 0 && r.r <= g.vw + 1, tag + ' ' + k + ' 水平方向在视口内 (x=' + r.x + ', right=' + r.r + ')');
    check(r.y >= 0 && r.b <= g.vh + 1, tag + ' ' + k + ' 垂直方向在视口内 (y=' + r.y + ', bottom=' + r.b + ' / vh=' + g.vh + ')');
  }
}

try {
  await b.launch('about:blank');
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  // ---------------- 1. 430×932：默认收起 ----------------
  console.log('\n[430×932] 默认收起');
  await setViewport(430, 932);
  await go();
  let g = await geo();
  noHoriz(g, '430');
  inViewport(g, '430');
  check(g.panel.vis && g.panel.w <= g.vw - 16, '抽屉宽度留出 8px 边距');
  check(g.panel.y >= g.topbar.b, '抽屉不压住顶栏 (panel.y=' + g.panel.y + ' >= topbar.b=' + g.topbar.b + ')');
  check(g.collapsed, '手机端默认收起');
  check(g.panel.h <= 90, '收起后只占底部一条 (h=' + g.panel.h + ')');
  check(g.mini.disp !== 'none' && g.miniText.length > 0, '收起态显示一行摘要：' + g.miniText);
  check(g.scroll && g.scroll.disp === 'none', '收起态隐藏完整表单');
  check(g.collapse.disp !== 'none', '收起条上有展开按钮');
  await shot('01-default-430.png');

  // 点标题条展开
  await b.clickSelector('#panelHead');
  await sleep(450);
  g = await geo();
  check(!g.collapsed, '点标题条展开面板');
  check(g.scroll && g.scroll.disp !== 'none', '展开后显示起终点表单');
  check(g.toggle.disp !== 'none', '展开后出现「图例」按钮');
  check(g.mini.disp === 'none', '展开后隐藏摘要');
  check(g.panel.h <= g.vh - g.topbar.b, '展开后抽屉仍在屏幕内 (h=' + g.panel.h + ')');
  inViewport(g, '430-expanded');
  await shot('02-expanded-430.png');

  // 展开图例
  await b.clickSelector('#panelToggle');
  await sleep(450);
  g = await geo();
  check(!!g.legend.vis, '点「图例」后展开图例');
  check(g.scroll.sh <= g.scroll.ch + 1, '展开态表单不被裁切 (scroll=' + JSON.stringify(g.scroll) + ')');
  await shot('02b-legend-430.png');

  // 再点标题条收起
  await b.clickSelector('#panelHead');
  await sleep(400);
  g = await geo();
  check(g.collapsed && !g.legend.vis, '再点标题条收起（图例一起复位）');
  await shot('02c-collapsed-again.png');

  // ---------------- 2. 选好起终点：摘要跟着更新 ----------------
  console.log('\n[430×932] 路线（收起态摘要）');
  await b.eval(`window.__navDebug.setPlaces('文采园','图书馆')`, { awaitPromise: false });
  await sleep(900);
  g = await geo();
  inViewport(g, '430-route');
  check(g.collapsed && g.panel.h <= 90, '有路线时仍保持收起');
  check(/文采园/.test(g.miniText) && /图书馆/.test(g.miniText), '摘要显示起终点：' + g.miniText);
  check(/820/.test(g.miniText), '摘要显示路线距离：' + g.miniText);
  const places = JSON.parse(await b.eval('JSON.stringify(window.__navDebug.currentPlaces())'));
  check(!!places.from && !!places.to, '路线已算好 (' + places.from + ' → ' + places.to + ')');
  await shot('03-route-430.png');

  // 展开看路线详情
  await b.clickSelector('#panelHead');
  await sleep(450);
  g = await geo();
  const statusTxt = await b.eval('document.getElementById("status").textContent');
  check(!g.collapsed && /米|m/.test(statusTxt), '展开后状态栏显示路线详情');
  await shot('03b-route-expanded-430.png');
  await b.clickSelector('#panelHead');
  await sleep(300);

  // ---------------- 3. 建筑信息卡 ----------------
  console.log('\n[430×932] 建筑卡');
  await b.eval(`window.__onBuildingClick({id:'B002'})`, { awaitPromise: false });
  await sleep(500);
  g = await geo();
  check(g.bcard.disp !== 'none', '建筑卡显示');
  check(g.bcard.y > g.topbar.b, '建筑卡在顶栏下方 (y=' + g.bcard.y + ')');
  check(g.panel.b <= g.vh + 1, '建筑卡出现后抽屉仍在屏内 (panel.b=' + g.panel.b + ')');
  check(g.panel.y === g.bcard.b + 8 || g.panel.y >= g.bcard.b, '建筑卡与抽屉不重叠');
  await shot('04-bcard-430.png');
  await b.eval(`document.getElementById('bcard-x').click()`, { awaitPromise: false });
  await sleep(300);

  // ---------------- 4. 语心浮层 ----------------
  console.log('\n[430×932] 语心');
  await b.clickSelector('#ai-open');
  await sleep(600);
  g = await geo();
  check(g.aiOpen && g.ai.disp === 'flex', '点顶栏「语心」打开浮层');
  check(g.ai.w >= g.vw - 20, '浮层接近全宽 (w=' + g.ai.w + ')');
  inViewport(g, '430-ai');
  check(g.aiInput.b <= g.vh + 1, '输入框在屏幕内 (bottom=' + g.aiInput.b + ')');
  await shot('05-ai-430.png');
  await b.eval(`document.querySelector('#ai-input').focus()`, { awaitPromise: false });
  await b.type('#ai-input', '从文采园怎么去图书馆？');
  await b.eval(`document.getElementById('ai-send').click()`, { awaitPromise: false });
  await sleep(1200);
  await shot('06-ai-answer-430.png');
  await b.clickSelector('#ai-close');
  await sleep(300);
  g = await geo();
  check(!g.aiOpen && g.ai.disp === 'none', '点 ✕ 关闭语心浮层');

  // ---------------- 5. 第一人称漫游 ----------------
  console.log('\n[430×932] 漫游');
  await b.eval(`window.__walk.start()`, { awaitPromise: false });
  await sleep(1000);
  g = await geo();
  inViewport(g, '430-walk');
  if (g.walkbar && g.walkbar.vis) {
    check(g.walkbar.w <= g.vw, '漫游控制条不超宽 (w=' + g.walkbar.w + ')');
    check(g.walkbar.b <= g.vh + 1, '漫游控制条在屏幕内');
  }
  await shot('07-walk-430.png');
  await b.eval(`window.__walk.stop()`, { awaitPromise: false });
  await sleep(300);

  // ---------------- 6. 英文 ----------------
  console.log('\n[430×932] 英文');
  await go('?lang=en');
  g = await geo();
  noHoriz(g, 'en');
  inViewport(g, 'en');
  check(g.collapsed, '英文手机端也默认收起');
  check(/Tap to plan/.test(g.miniText), '英文收起摘要：' + g.miniText);
  const ariaEn = await b.eval(`document.getElementById('panelCollapse').getAttribute('aria-label')`);
  check(ariaEn === 'Expand', '英文展开按钮 aria-label=' + ariaEn);
  await shot('08-en-430.png');

  // ---------------- 7. 小屏 ----------------
  console.log('\n[360×640]');
  await setViewport(360, 640);
  await go();
  g = await geo();
  noHoriz(g, '360');
  inViewport(g, '360');
  check(g.collapsed && g.collapse.vis && g.mini.vis, '360 默认收起且摘要/展开按钮可见');
  await shot('09-360.png');

  console.log('\n[320×568]');
  await setViewport(320, 568);
  await go();
  g = await geo();
  noHoriz(g, '320');
  inViewport(g, '320');
  check(g.collapsed && g.panel.h <= 90, '320 收起条仍在屏内 (h=' + g.panel.h + ')');
  await shot('10-320.png');

  console.log('\n[320×568] 英文（顶栏最挤的情况）');
  await go('?lang=en');
  g = await geo();
  noHoriz(g, '320-en');
  inViewport(g, '320-en');
  const hdr = JSON.parse(await b.eval(`JSON.stringify((() => {
    const b = document.querySelector('#brand b').getBoundingClientRect();
    const c = document.querySelector('#campusSwitch').getBoundingClientRect();
    return { brandRight: Math.round(b.right), campusLeft: Math.round(c.left) };
  })())`));
  check(hdr.brandRight <= hdr.campusLeft, '320 英文顶栏品牌不被校区开关压住 (brand.right=' + hdr.brandRight + ' <= campus.left=' + hdr.campusLeft + ')');
  await shot('10b-320-en.png');

  // ---------------- 8. 平板 / 横屏 / 桌面 ----------------
  console.log('\n[768×1024] 平板');
  await setViewport(768, 1024, 2);
  await go();
  g = await geo();
  noHoriz(g, '768');
  inViewport(g, '768');
  check(!g.collapsed && !g.mini.vis && g.collapse.disp === 'none', '平板走桌面布局（不出现手机收起条）');
  check(!!g.legend.vis, '平板图例常显');
  await shot('11-tablet-768.png');

  console.log('\n[844×390] 横屏');
  await setViewport(844, 390, 3);
  await go();
  g = await geo();
  noHoriz(g, '844x390');
  inViewport(g, '844x390');
  await shot('12-landscape-844.png');

  console.log('\n[1440×900] 桌面');
  await setViewport(1440, 900, 1);
  await go();
  g = await geo();
  noHoriz(g, '1440');
  inViewport(g, '1440');
  check(g.panel.x < 100 && g.panel.w >= 300 && g.panel.w <= 310, '桌面端仍是左侧 302px 面板 (x=' + g.panel.x + ', w=' + g.panel.w + ')');
  check(!g.collapsed && !g.mini.vis && g.collapse.disp === 'none', '桌面端不出现手机收起条');
  check(!!g.legend.vis, '桌面端图例常显');
  await shot('13-desktop-1440.png');

  // 桌面端建筑卡仍应居中贴底
  await b.eval(`window.__onBuildingClick({id:'B002'})`, { awaitPromise: false });
  await sleep(400);
  g = await geo();
  check(g.bcard.disp !== 'none' && g.bcard.b <= g.vh && g.bcard.b > g.vh - 40, '桌面端建筑卡贴底 (bottom=' + g.bcard.b + ')');
  check(g.bcard.x > g.panel.r, '桌面端建筑卡不压左侧面板');
  await shot('14-desktop-bcard.png');

  // ---------------- 9. 深链 ?q= 自动开语心 ----------------
  console.log('\n[430×932] 深链 ?q=');
  await setViewport(430, 932);
  await go('?ai=off&lang=zh&q=' + encodeURIComponent('图书馆几层？'), 2600);
  await sleep(1600);
  g = await geo();
  check(g.aiOpen && g.ai.disp === 'flex', '带 ?q= 进来时自动打开语心');
  inViewport(g, '430-deeplink');
  await shot('15-deeplink-430.png');

  console.log('\n结果：' + (fails.length ? fails.length + ' 项未通过' : '全部通过'));
  if (fails.length) for (const f of fails) console.log(' - ' + f);
  process.exitCode = fails.length ? 1 : 0;
} finally {
  await b.close();
}
