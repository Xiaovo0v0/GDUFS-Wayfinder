import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/3d';
fs.mkdirSync(OUT, { recursive: true });
const url = 'file:///C:/Users/86134/Desktop/gdufs/gdufs-3d/index.html';
const b = new Browser({ port: 9335, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await b.launch(url);
  await sleep(6000);
  const diag = await b.eval(`(() => ({
    webgl: (() => { try { const c=document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl')); } catch(e){ return 'err:'+e.message; } })(),
    debug: window.__navDebug ? { trees: window.__navDebug.treeCount, hasCam: !!window.__navDebug.camera } : null,
    status: (document.getElementById('status')||{}).innerText || '',
    labels: document.querySelectorAll('.lbl').length,
    errors: window.__errors || []
  }))()`);
  console.log(JSON.stringify(diag, null, 2));

  const name = process.argv[2] || 'shot';
  await b.shot(`${OUT}/${name}.png`);

  // reset view + take a second angle if requested
  if (process.argv[3] === 'angles') {
    await b.eval(`(() => { const d = window.__navDebug; const c = d.camera, t = d.controls.target; c.position.set(t.x + 420, 320, t.z + 520); d.controls.update(); return 1; })()`, { awaitPromise: false });
    await sleep(1200);
    await b.shot(`${OUT}/${name}_angle.png`);
  }
} finally {
  await b.close();
}
