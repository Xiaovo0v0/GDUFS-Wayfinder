// 检查"解压到含中文/空格路径 + 中文文件名"时能否正常打开（评委常见的操作）。
//   node tools/check_paths.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Browser } from './cdp.mjs';

const REPO = 'C:/Users/86134/Desktop/gdufs';
const SRC = path.join(REPO, 'gdufs-3d/dist/index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cases = [
  { dir: '新建文件夹', file: '尚行-广外校园向导.html' },
  { dir: 'my folder 空格', file: '尚行-广外校园向导.html' },
  { dir: 'test ascii', file: 'index.html' },
];

let port = 9600;
let ok = true;

for (const c of cases) {
  const root = path.join(os.tmpdir(), c.dir);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  fs.copyFileSync(SRC, path.join(root, c.file));

  const fileUrl = 'file:///' + path.join(root, c.file).replace(/\\/g, '/');
  const url = encodeURI(fileUrl); // 模拟浏览器双击时的编码方式
  const b = new Browser({ port: port++, visible: false });
  await b.launch(url);
  await sleep(6500);
  const s = JSON.parse(await b.eval(`JSON.stringify({
    mode:(window.__navDebug||{}).mode,
    b:(window.GDUFS_DATA||{buildings:[]}).buildings.length
  })`, { awaitPromise: false }).catch(() => '{"mode":"eval-fail","b":0}'));
  const good = s.mode === 'glb' && s.b === 51;
  console.log(`${good ? '✅' : '❌'} ${c.dir}/${c.file}  →  ${JSON.stringify(s)}`);
  if (!good) ok = false;
  await b.close();
  await sleep(800);
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(ok ? '\n✅ 中文路径 / 空格路径 / 中文文件名都没问题' : '\n❌ 有路径打不开');
process.exit(ok ? 0 : 1);
