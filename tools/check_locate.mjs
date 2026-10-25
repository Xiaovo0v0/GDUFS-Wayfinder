// 「定位我的位置」验收：真实浏览器 + CDP 伪 GPS → 场景坐标 → 标记 → 算路 → 取消
//   node tools/check_locate.mjs                 本地 http（先起 http.server 8080）
//   node tools/check_locate.mjs --port 8081
//   node tools/check_locate.mjs --file          额外验一遍双击本地 HTML（file://）也能定位
//
// 原理：CDP 的 Browser.grantPermissions + Emulation.setGeolocationOverride 可以模拟
// "用户允许定位 + 手机在图书馆西南 60 米"，不需要真 GPS，也不需要人工点权限弹窗。
import { Browser } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = argOf('--port', '8080');
const WITH_FILE = args.includes('--file');
const URL_HTTP = `http://127.0.0.1:${PORT}/?lang=zh`;
const URL_FILE = 'file:///' + path.resolve('gdufs-3d/index.html').replace(/\\/g, '/') + '?lang=zh';

// 图书馆西南侧、教学楼 E 栋边上（南校区真实经纬度）
const FIX = { lat: 23.0675, lon: 113.3919, accuracy: 12 };
const SHOT_DIR = 'artifacts/locate';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grantAndFix(browser, origin) {
  try {
    await browser.send('Browser.grantPermissions', { permissions: ['geolocation'], origin });
  } catch (e) {
    console.log('  (授权失败，继续跑：' + e.message.slice(0, 80) + ')');
  }
  await browser.send('Emulation.setGeolocationOverride', {
    latitude: FIX.lat, longitude: FIX.lon, accuracy: FIX.accuracy,
  });
}

async function runOne(browser, url, origin, label) {
  console.log(`\n【${label}】${url}`);
  await browser.goto(url, 3000);
  await grantAndFix(browser, origin);
  await browser.goto(url, 2500);           // 让授权在导航前生效
  await sleep(1200);

  await browser.eval(`document.querySelector('#btnLocate').click()`, { awaitPromise: false });
  const got = await browser.waitFor('window.__navDebug.getMyPosition()', 12000);
  check(`${label}：拿到定位并落到地图上`, !!got);

  if (!got) {
    const status = await browser.eval(`document.querySelector('#status').innerText`);
    console.log('    status:', String(status).slice(0, 160));
    return;
  }

  const s = JSON.parse(await browser.eval(`JSON.stringify({
    me: window.__navDebug.getMyPosition(),
    expect: window.__navGeo.project(${FIX.lat}, ${FIX.lon}),
    datum: window.__navGeo.datum,
    secure: window.isSecureContext,
    btn: document.querySelector('#btnLocate').textContent,
    startSel: document.querySelector('#startSelect').value,
    startOpt: (document.querySelector('#startSelect').options[1] || {}).text,
    sprites: (() => { let n = 0; window.__navDebug.scene.traverse(o => { if (o.isSprite) n++; }); return n; })(),
    status: document.querySelector('#status').innerText.replace(/\\s+/g, ' ')
  })`));

  const dx = Math.abs(s.me.x - s.expect.x), dz = Math.abs(s.me.z - s.expect.z);
  check(`${label}：WGS84 → 场景坐标偏差 < 1 m`, dx < 1 && dz < 1,
    `Δx=${dx.toFixed(2)} Δz=${dz.toFixed(2)} m`);
  check(`${label}：精度取用 GPS 上报值`, Math.round(s.me.accuracy) === FIX.accuracy, '±' + Math.round(s.me.accuracy) + ' m');
  check(`${label}：贴路网距离合理`, s.me.snap >= 0 && s.me.snap < 60, s.me.snap + ' m');
  check(`${label}：起点自动切到「我的位置」`, s.startSel === '-2' && /我的位置/.test(s.startOpt), s.startOpt);
  check(`${label}：状态栏提示最近地标`, /我的位置|教学楼/.test(s.status), s.status.slice(0, 60));

  // 从我的位置算到图书馆
  const r = JSON.parse(await browser.eval(`JSON.stringify(window.__navDebug.setPlaces('我的位置','图书馆'))`));
  await sleep(500);
  const d = await browser.eval('Math.round(window.__lastRouteDist||0)');
  check(`${label}：可从「我的位置」算出路线`, r.from === '我的位置' && r.to === '图书馆' && d > 20,
    `${r.from} → ${r.to} · ${d} m`);

  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await browser.shot(path.join(SHOT_DIR, label.includes('file') ? 'file-route.png' : 'http-route.png'));

  // 再点一次 = 取消定位
  await browser.eval(`document.querySelector('#btnLocate').click()`, { awaitPromise: false });
  await sleep(400);
  const cleared = await browser.eval('!window.__navDebug.getMyPosition()');
  check(`${label}：再点一次可取消定位`, !!cleared);
}

const browser = new Browser({ port: 9488, profile: path.join(os.tmpdir(), 'gdufs-locate-profile') });
try {
  await browser.launch(URL_HTTP);
  await runOne(browser, URL_HTTP, `http://127.0.0.1:${PORT}`, 'http');
  if (WITH_FILE) {
    await runOne(browser, URL_FILE, 'file://', 'file');
  }
  const exceptions = browser.events.filter((e) => e.method === 'Runtime.exceptionThrown');
  check('无未捕获异常', exceptions.length === 0,
    exceptions.length ? String(exceptions[0].params?.exceptionDetails?.exception?.description).slice(0, 160) : '');
} catch (e) {
  check('脚本自身未崩溃', false, String(e.message).slice(0, 160));
} finally {
  await browser.close();
}

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} 通过`);
process.exit(bad.length ? 1 : 0);
