import { Browser } from './cdp.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = new Browser({ port: 9391, visible: false });
const url = process.argv[2];
await b.launch(url);
await sleep(4000);
const errs = await b.eval(`(() => {
  const out = [];
  return JSON.stringify({ data: typeof window.GDUFS_DATA, b: window.GDUFS_DATA && window.GDUFS_DATA.buildings ? window.GDUFS_DATA.buildings.length : -1,
    nav: typeof window.__navDebug, THREE: typeof window.THREE, err: window.__lastError || '' });
})()`, { awaitPromise: false });
console.log(errs);
const msgs = b.events.filter(e => /exceptionThrown|consoleAPICalled/.test(e.method)).slice(0, 5)
  .map(e => JSON.stringify(e.params).slice(0, 300));
console.log('events:', msgs.join('\n'));
await b.close();
