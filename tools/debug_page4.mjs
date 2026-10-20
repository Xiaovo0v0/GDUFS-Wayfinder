import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9368, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html?v=' + Date.now());
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Page.reload', { ignoreCache: true });
  await sleep(7000);
  const info = await b.eval(`({
    url: location.href,
    navKeys: window.__navDebug ? Object.keys(window.__navDebug) : null,
    hasUI: !!document.getElementById('ai'),
    hasFaq: !!window.GDUFS_FAQ,
    hasCfg: !!window.GDUFS_AI,
    mode: window.__navDebug && window.__navDebug.mode
  })`);
  console.log(JSON.stringify(info, null, 2));
} finally {
  await b.close();
}
