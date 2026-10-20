import { Browser } from './cdp.mjs';

const target = process.argv[2] || 'file:///C:/Users/86134/Desktop/gdufs/gdufs-3d/index.html';
const out = process.argv[3] || null;
const b = new Browser({ port: 9336, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await b.launch(target);
  await sleep(7000);
  const d = await b.eval(`({
    url: location.href,
    mode: window.__navDebug && window.__navDebug.mode,
    glbObjects: window.__navDebug && window.__navDebug.glbObjects,
    glbTagged: window.__navDebug && window.__navDebug.glbTagged,
    trees: window.__navDebug && window.__navDebug.treeCount,
    labels: document.querySelectorAll('.lbl').length,
    sub: (document.querySelector('#panel .sub') || {}).innerText
  })`);
  console.log(JSON.stringify(d, null, 2));
  if (out) { await b.shot(out); console.log('shot', out); }
} finally {
  await b.close();
}
