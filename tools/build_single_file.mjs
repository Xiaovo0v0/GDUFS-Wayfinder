// 打包成单个 HTML 文件：把 three / 控件 / 数据 / GLB 全部内联，双击即可打开（含 LOD2 模型），也可直接上传当作品链接。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('gdufs-3d');
const OUT = path.join(ROOT, 'dist');
fs.mkdirSync(OUT, { recursive: true });

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let html = read('index.html');

// 1) 内联所有本地脚本（按 index.html 里的顺序）
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
console.log('scripts:', scripts);

let inline = '';
for (const src of scripts) {
  const p = path.join(ROOT, src);
  if (!fs.existsSync(p)) {
    // 例如 ai-config.local.js（存密钥，不进仓库）：没有就跳过，前端自动降级
    console.warn('跳过缺失的脚本：', src);
    continue;
  }
  const code = read(src);
  inline += `\n<!-- ${src} -->\n<script>\n${code.replace(/<\/script>/g, '<\\/script>')}\n</script>\n`;
}
html = html.replace(/\s*<script src="[^"]+"><\/script>/g, '');

// 2) GLB → data URI（南校、北校各一份）
const glb = fs.readFileSync(path.join(ROOT, 'assets/gdufs_buildings.glb'));
const glbUri = 'data:model/gltf-binary;base64,' + glb.toString('base64');
let glbScript = `<script>window.GDUFS_GLB_URL = ${JSON.stringify(glbUri)};</script>`;

const northGlbPath = path.join(ROOT, 'assets/north_buildings.glb');
if (fs.existsSync(northGlbPath)) {
  const nglb = fs.readFileSync(northGlbPath);
  const nUri = 'data:model/gltf-binary;base64,' + nglb.toString('base64');
  glbScript += `\n<script>window.GDUFS_NORTH_GLB_URL = ${JSON.stringify(nUri)};</script>`;
  console.log('north glb', (nglb.length / 1024).toFixed(0) + ' KB');
}

// 3) 插到 </body> 前
html = html.replace('</body>', `${glbScript}\n${inline}\n</body>`);

// 4) 北校区栅格图层（道路 / 相思河）→ data URI，保证单文件也能看到
for (const name of ['north-roads.png', 'north-river.png']) {
  const p = path.join(ROOT, 'assets', name);
  if (!fs.existsSync(p)) continue;
  const uri = 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
  html = html.split('assets/' + name).join(uri);
}

// 5) 输出 index.html 与中文名两份，便于不同托管环境
const outFile = path.join(OUT, '广外校园向导.html');
fs.writeFileSync(outFile, html, 'utf8');
fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
console.log('built', outFile, kb + ' KB', '| glb', (glb.length / 1024).toFixed(0) + ' KB');
