// 编码体检：node tools/check_encoding.mjs [--staged] [文件…]
//
// 为什么要有这个脚本：这台机器默认 shell 是 Windows PowerShell 5.1，它按 GBK 读
// 无 BOM 的 UTF-8。`(Get-Content -Raw x.js) -replace ... | Set-Content -Encoding utf8`
// 这种改法会把中文写成乱码，而且**命令不报错** —— 上一次事故就是这么把
// .gitignore 和源文件搞成 UTF-8 与 GBK 混杂的（见 docs/HANDOFF-2026-10-31.md:250）。
// 静默错误必须有自动检查：光在文档里写「不要过 PowerShell 管道」，没人会照做。
//
// 三类检测：
//   1. 非法 UTF-8 字节序列（GBK 文件被当 UTF-8 读、或写坏了的多字节序列）
//   2. U+FFFD 替换字符 / U+0080–U+009F 控制字符
//   3. GBK 乱码：把疑似片段按 GBK 反查字节、再按 UTF-8 解码 —— 解得出干净中文
//      就说明它原本是 UTF-8，被按 GBK 读了一遍。命中时直接给出修复后的文字。
//
// 退出码：0 干净 / 1 有问题 / 2 用法错误。

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.html', '.htm',
  '.css', '.scss', '.ps1', '.cmd', '.bat', '.py', '.yml', '.yaml', '.svg', '.glsl',
  '.csv',
]);

// UTF-8 标点被 GBK 读错后的固定产物（码位见下）。这几个字正常中文里根本不用，
// 出现即确诊。别把它们的字形抄进注释 —— 本脚本会连自己一起抓。
const PUNCT_ARTIFACT = /[\u951b\u9286\u9225\u9226]/;

const MAX_BYTES = 8 * 1024 * 1024; // 超大文件（内嵌数据的 html）跳过

const args = process.argv.slice(2);
const stagedOnly = args.includes('--staged');
const quiet = process.env.CHECK_ENCODING_QUIET || args.includes('--quiet');
const explicit = args.filter((a) => !a.startsWith('-'));

function git(argsArr) {
  try {
    return execFileSync('git', argsArr, { encoding: 'buffer', maxBuffer: 1 << 28 });
  } catch (e) {
    console.error('git ' + argsArr.join(' ') + ' 失败：' + e.message);
    process.exit(2);
  }
}

const splitZ = (buf) => buf.toString('utf8').split('\0').filter(Boolean);

// ---------------- GBK 反查表（char -> [b1, b2]） ----------------
// Node 只有 GBK 解码器，没有编码器。把全部合法双字节码位一次性喂给解码器，
// 输出串的第 i 个字符就对应第 i 组字节 —— 于是得到一张反查表。
let gbkMap;
function gbkReverse() {
  if (gbkMap !== undefined) return gbkMap;
  const pairs = [];
  for (let b1 = 0x81; b1 <= 0xfe; b1++) {
    for (let b2 = 0x40; b2 <= 0xfe; b2++) {
      if (b2 === 0x7f) continue;
      pairs.push(b1, b2);
    }
  }
  const n = pairs.length / 2;
  let s;
  try {
    s = new TextDecoder('gbk', { fatal: false }).decode(Buffer.from(pairs));
  } catch {
    gbkMap = null; // 这个 node 没编 GBK 支持：只做前两类检测
    return gbkMap;
  }
  if (s.length !== n) {
    // 有非法码位被打断，逐对解码兜底（慢但只跑一次）
    const map = new Map();
    const dec = new TextDecoder('gbk', { fatal: false });
    for (let i = 0; i < n; i++) {
      const ch = dec.decode(Buffer.from([pairs[i * 2], pairs[i * 2 + 1]]));
      if (ch.length === 1 && ch !== '\uFFFD' && !map.has(ch)) map.set(ch, [pairs[i * 2], pairs[i * 2 + 1]]);
    }
    gbkMap = map;
  } else {
    const map = new Map();
    for (let i = 0; i < n; i++) {
      const ch = s[i];
      if (ch !== '\uFFFD' && !map.has(ch)) map.set(ch, [pairs[i * 2], pairs[i * 2 + 1]]);
    }
    gbkMap = map;
  }
  return gbkMap;
}

const utf8fatal = new TextDecoder('utf-8', { fatal: true });

// 把疑似乱码片段按 GBK 反查成字节，再按 UTF-8 解码。解得干净就返回原文。
function unmojibake(run) {
  const map = gbkReverse();
  if (!map) return null;
  const bytes = [];
  for (const ch of run) {
    const b = map.get(ch);
    if (!b) return null;
    bytes.push(b[0], b[1]);
  }
  let out;
  try {
    out = utf8fatal.decode(Buffer.from(bytes));
  } catch {
    return null;
  }
  if (!out || out.includes('\uFFFD')) return null;
  if (/[\u0000-\u001f]/.test(out)) return null;
  // 解出来的东西应该像正常文案：中文或 ASCII 为主
  const sensible = [...out].filter((c) => /[\u4e00-\u9fa5]/.test(c) || /[A-Za-z0-9 .,:;!?"'()\-\/]/.test(c)).length;
  return sensible / [...out].length >= 0.8 ? out : null;
}

// ---------------- 扫描 ----------------
const problems = [];
const add = (file, line, kind, detail) => problems.push({ file, line, kind, detail });

function looksText(file, buf) {
  if (TEXT_EXT.has(path.extname(file).toLowerCase())) return true;
  const base = path.basename(file);
  if (/^(README|LICENSE|NOTICE|AGENTS|CLAUDE|\.gitignore|\.gitattributes|\.editorconfig)$/i.test(base)) return true;
  if (buf.includes(0)) return false;
  const sample = buf.subarray(0, 4096).toString('utf8');
  return (sample.match(/[\u4e00-\u9fa5]/g) || []).length > 8 || /^\s*[#{\/<-]/m.test(sample);
}

function scan(file) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return;
  }
  if (!looksText(file, buf) || buf.length > MAX_BYTES) return;

  // 1. 非法 UTF-8：定位第一个坏字节，换算行号
  try {
    utf8fatal.decode(buf);
  } catch {
    let bad = -1;
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (c < 0x80) continue;
      const len = c >= 0xf0 ? 4 : c >= 0xe0 ? 3 : c >= 0xc0 ? 2 : 0;
      let ok = len > 0 && i + len <= buf.length;
      for (let k = 1; ok && k < len; k++) if ((buf[i + k] & 0xc0) !== 0x80) ok = false;
      if (!ok) { bad = i; break; }
      i += len - 1;
    }
    const lineNo = bad < 0 ? 0 : buf.subarray(0, bad).toString('latin1').split('\n').length;
    const hex = bad < 0 ? '' : [...buf.subarray(bad, bad + 4)].map((x) => '0x' + x.toString(16).padStart(2, '0')).join(' ');
    add(file, lineNo, '非法 UTF-8', hex);
  }

  const lines = buf.toString('utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln) continue;
    if (ln.includes('\uFFFD')) add(file, i + 1, 'U+FFFD', snippet(ln));
    if (/[\u0080-\u009f]/.test(ln)) add(file, i + 1, 'C1 控制字符', snippet(ln));
    if (PUNCT_ARTIFACT.test(ln)) add(file, i + 1, 'GBK 乱码标点', snippet(ln));

    // 3. 逐段重解码：只盯非 ASCII 的连续片段
    const re = /[^\x00-\x7f]+/g;
    let m;
    while ((m = re.exec(ln)) !== null) {
      const run = m[0];
      if (run.length < 3) continue;
      const fixed = unmojibake(run);
      if (fixed && fixed !== run) {
        add(file, i + 1, 'GBK 乱码', '应为「' + truncate(fixed) + '」');
        break; // 一行报一次就够了
      }
    }
  }
}

const snippet = (l) => truncate(l.trim());
const truncate = (s) => (s.length > 80 ? s.slice(0, 80) + '…' : s);

const files = explicit.length
  ? explicit
  : stagedOnly
    ? splitZ(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--ita-visible-in-index', '-z']))
    : splitZ(git(['ls-files', '-z']));

for (const f of files) scan(f);

if (!problems.length) {
  if (!quiet) console.log(`编码体检 ✓ ${files.length} 个文件干净`);
  process.exit(0);
}

const byFile = new Map();
for (const p of problems) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}
console.error(`\n✗ 编码问题 ${problems.length} 处，涉及 ${byFile.size} 个文件：\n`);
for (const [file, list] of byFile) {
  console.error(`  ${file}`);
  for (const p of list.slice(0, 6)) console.error(`    :${p.line}  ${p.kind}  ${p.detail}`);
  if (list.length > 6) console.error(`    … 另有 ${list.length - 6} 处`);
}
console.error('\n修法：含中文的文件一律用 write/edit 工具或 Python 读写，不要过 PowerShell 管道。');
console.error('详见 AGENTS.md「编码」一条与 docs/HANDOFF-2026-10-31.md:250。\n');
process.exit(1);
