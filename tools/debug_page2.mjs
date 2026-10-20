import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9368, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('about:blank');
  await b.send('Log.enable');
  await b.send('Runtime.enable');
  await b.goto('http://127.0.0.1:8765/gdufs-3d/index.html', 6000);
  await sleep(2000);
  const info = await b.eval(`({
    url: location.href,
    navKeys: window.__navDebug ? Object.keys(window.__navDebug) : null,
    hasUI: !!document.getElementById('ai'),
    hasFaq: !!window.GDUFS_FAQ,
    hasCfg: !!window.GDUFS_AI
  })`);
  console.log(JSON.stringify(info, null, 2));
  const logs = b.events
    .filter((e) => e.method === 'Log.entryAdded' || e.method === 'Runtime.exceptionThrown')
    .map((e) => e.params.entry?.text || e.params.exceptionDetails?.exception?.description || JSON.stringify(e.params).slice(0, 240));
  console.log('logs:', JSON.stringify(logs.slice(0, 10), null, 2));
} finally {
  await b.close();
}
