/* 近景截图：按建筑名把相机挪到楼前 45~70 m、离地 18~30 m，用于检查立面/屋面细节。
 * 用法：node tools/shot_close.mjs 图书馆 教学楼B栋 实验楼C区
 */
import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/3d';
fs.mkdirSync(OUT, { recursive: true });
const url = 'http://127.0.0.1:8080/index.html?cb=' + Date.now();
const b = new Browser({ port: 9337, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const names = process.argv.slice(2);
if (!names.length) names.push('图书馆');

try {
  await b.launch(url);
  await sleep(6500);

  for (const nm of names) {
    const ok = await b.eval(`(() => {
      const d = window.__navDebug; if (!d || !d.camera) return 'no-camera';
      const list = (window.GDUFS_DATA.buildings || []).concat(window.GDUFS_SUBPLACES || []);
      const b = list.find(x => x.name === ${JSON.stringify(nm)});
      if (!b) return 'not-found';
      const ring = (b.rings && b.rings[0]) || b.ring || [];
      let sx = 0, sz = 0;
      ring.forEach(p => { sx += p[0]; sz += p[1]; });
      const c = ring.length ? [sx / ring.length, sz / ring.length] : (b.access || [0, 0]);
      // 站在「出入口向外 40 m」的位置看楼，避免相机落在体量内部
      const acc = b.access || [c[0], c[1] + 40];
      let dx = acc[0] - c[0], dz = acc[1] - c[1];
      let len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const out = 95 + Math.min(85, Math.sqrt(b.area || 2000) * 0.35);
      const eye = [acc[0] + dx * out, Math.max(22, (b.height || 20) * 1.5), acc[1] + dz * out];
      d.camera.position.set(eye[0], eye[1], eye[2]);
      d.camera.lookAt(c[0], Math.max(6, (b.height || 20) * 0.45), c[1]);
      d.controls.target.set(c[0], 0, c[1]);
      d.controls.update();
      return 'ok:eye=' + eye.map(v => v.toFixed(0)).join(',') + ' out=' + out.toFixed(0);
    })()`, { awaitPromise: false });
    console.log(nm, '→', ok);
    await sleep(1400);
    const safe = nm.replace(/[\\/:*?"<>|]/g, '_');
    await b.shot(`${OUT}/close2_${safe}.png`);
  }
} finally {
  await b.close();
}
