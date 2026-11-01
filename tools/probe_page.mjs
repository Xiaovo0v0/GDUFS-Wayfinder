// 排查：headless 下页面为什么没起来（WebGL / 报错 / canvas）
//   node tools/probe_page.mjs [url]
import { Browser } from './cdp.mjs';

const url = process.argv[2] || 'http://127.0.0.1:8080/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = new Browser({ port: 9341 });
try {
  await b.launch('about:blank');
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Runtime.enable');
  await b.eval(`(() => {
    window.__errs = [];
    addEventListener('error', (e) => window.__errs.push('error: ' + (e.message || e.type) + ' @' + (e.filename || '') + ':' + (e.lineno || '')));
    addEventListener('unhandledrejection', (e) => window.__errs.push('reject: ' + (e.reason && (e.reason.message || e.reason))));
    const ce = console.error.bind(console);
    console.error = function () { window.__errs.push('console.error: ' + [...arguments].join(' ')); return ce(...arguments); };
  })()`, { awaitPromise: false });
  await b.send('Page.navigate', { url });
  await sleep(6000);
  const info = await b.eval(`(() => {
    const c = document.createElement('canvas');
    const gl2 = !!c.getContext('webgl2');
    const gl1 = !!c.getContext('webgl');
    const cv = document.querySelector('canvas');
    return {
      webgl2: gl2, webgl1: gl1,
      canvasInDom: !!cv, canvasSize: cv ? [cv.width, cv.height] : null,
      three: typeof window.THREE,
      data: !!(window.GDUFS_DATA && window.GDUFS_DATA.buildings),
      buildings: window.GDUFS_DATA ? (window.GDUFS_DATA.buildings || []).length : null,
      navDebug: !!(window.__navDebug && window.__navDebug.setPlaces),
      status: (document.getElementById('status') || {}).innerText,
      errs: (window.__errs || []).slice(0, 12)
    };
  })()`);
  console.log(JSON.stringify(info, null, 1));
} finally {
  await b.close();
}
