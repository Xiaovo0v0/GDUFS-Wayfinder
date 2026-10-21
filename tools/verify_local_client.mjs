// 验证本地客户端安装包：解压到临时目录，用 file:// 打开，检查渲染是否正常。
//   node tools/verify_local_client.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Browser } from './cdp.mjs';

const REPO = 'C:/Users/86134/Desktop/gdufs';
const ZIP = path.join(REPO, 'deliverables/尚行-本地客户端.zip');
const DIR = path.join(os.tmpdir(), 'sx_local_verify_' + Date.now());

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

// 用 PowerShell 解压，避免额外依赖
execFileSync('powershell', [
  '-NoProfile', '-Command',
  `Expand-Archive -LiteralPath '${ZIP}' -DestinationPath '${DIR}' -Force`,
], { stdio: 'inherit' });

const files = fs.readdirSync(DIR);
console.log('解压得到：', files.join(' / '));

const entry = ['index.html', '尚行-广外校园向导.html'].find((f) => files.includes(f));
if (!entry) {
  console.error('找不到入口 HTML');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = new Browser({ port: 9393, visible: false });
await b.launch('file:///' + path.join(DIR, entry).replace(/\\/g, '/'));
await sleep(7000);
const s = await b.eval(`JSON.stringify({
  mode: (window.__navDebug||{}).mode,
  buildings: (window.GDUFS_DATA||{buildings:[]}).buildings.length,
  trees: (window.__navDebug||{}).treeCount,
  glb: typeof window.GDUFS_GLB_URL,
  north: (window.GDUFS_NORTH||{buildings:[]}).buildings.length,
  services: (window.GDUFS_SERVICE||[]).length,
  i18n: typeof window.GDUFS_LANG
})`, { awaitPromise: false });
console.log('运行状态：', s);
await b.shot(path.join(REPO, 'artifacts/3d/local_client_verify.png'));
await b.close();

const ok = (() => {
  const o = JSON.parse(s);
  return o.mode === 'glb' && o.buildings === 51 && o.services === 40 && o.glb === 'string';
})();
console.log(ok ? '✅ 本地客户端可用' : '❌ 本地客户端异常');
fs.rmSync(DIR, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
