// 打包成单个 HTML 文件：把 three / 控件 / 数据 / GLB 全部内联，双击即可打开（含 LOD2 模型），也可直接上传当作品链接。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/86134/Desktop/gdufs/gdufs-3d';
const OUT = path.join(ROOT, 'dist');
fs.mkdirSync(OUT, { recursive: true });

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let html = read('index.html');

// 1) 内联所有本地脚本（按 index.html 里的顺序）
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
console.log('scripts:', scripts);

let inline = '';
for (const src of scripts) {
  const code = read(src);
  inline += `\n<!-- ${src} -->\n<script>\n${code.replace(/<\/script>/g, '<\\/script>')}\n</script>\n`;
}
html = html.replace(/\s*<script src="[^"]+"><\/script>/g, '');

// 2) GLB → data URI
const glb = fs.readFileSync(path.join(ROOT, 'assets/gdufs_buildings.glb'));
const glbUri = 'data:model/gltf-binary;base64,' + glb.toString('base64');
const glbScript = `<script>window.GDUFS_GLB_URL = ${JSON.stringify(glbUri)};</script>`;

// 3) 插到 </body> 前
html = html.replace('</body>', `${glbScript}\n${inline}\n</body>`);

const outFile = path.join(OUT, '广外校园向导.html');
fs.writeFileSync(outFile, html, 'utf8');
const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
console.log('built', outFile, kb + ' KB', '| glb', (glb.length / 1024).toFixed(0) + ' KB');
