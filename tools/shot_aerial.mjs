/* 空中斜视截图：从校区东南方向 160 m 高处俯视，检查屋顶设备/屋面贴图。
 * 用法：node tools/shot_aerial.mjs out_name [height] [dist]
 */
import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/3d';
fs.mkdirSync(OUT, { recursive: true });
const url = 'http://127.0.0.1:8080/index.html?cb=' + Date.now();
const b = new Browser({ port: 9351, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const name = process.argv[2] || 'aerial';
const hgt = Number(process.argv[3] || 150);
const dist = Number(process.argv[4] || 260);

try {
  await b.launch(url);
  await b.waitFor("window.__navDebug && window.__navDebug.mode === 'glb'", 25000).catch(() => {});
  await sleep(1200);
  const info = await b.eval(`(() => {
    const d = window.__navDebug, cam = d.camera, c = d.controls.target;
    const cx = 0, cz = 60;
    cam.position.set(cx + ${dist}, ${hgt}, cz + ${Math.round(dist * 0.9)});
    cam.lookAt(cx, 0, cz);
    d.controls.target.set(cx, 0, cz);
    d.controls.update();
    return { clutter: d.roofClutter, trees: d.treeCount };
  })()`, { awaitPromise: false });
  console.log(JSON.stringify(info));
  await sleep(1600);
  await b.shot(`${OUT}/${name}.png`);
} finally {
  await b.close();
}
