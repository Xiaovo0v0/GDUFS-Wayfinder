import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9369, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('about:blank');
  const r = await b.eval(`(async () => {
    const res = await fetch('http://127.0.0.1:8765/gdufs-3d/index.html', { cache: 'no-store' });
    const t = await res.text();
    return { status: res.status, len: t.length, hasAI: t.indexOf('id="ai"') >= 0, hasNav: t.indexOf('navigator-ui.js') >= 0 };
  })()`);
  console.log(JSON.stringify(r));

  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Runtime.enable');
  await b.send('Log.enable');
  await b.goto('http://127.0.0.1:8765/gdufs-3d/index.html', 7000);
  await sleep(2000);
  const info = await b.eval(`({ hasUI: !!document.getElementById('ai'), navKeys: Object.keys(window.__navDebug || {}) })`);
  console.log(JSON.stringify(info));
  const logs = b.events.filter((e) => e.method === 'Log.entryAdded').map((e) => e.params.entry.text);
  console.log('logs', JSON.stringify(logs.slice(0, 6)));
  const reqs = b.events.filter((e) => e.method === 'Network.responseReceived' && e.params.response.url.includes('gdufs-3d')).map((e) => `${e.params.response.status} ${e.params.response.url.split('/').pop()}`);
  console.log('responses', JSON.stringify(reqs));
} finally {
  await b.close();
}
