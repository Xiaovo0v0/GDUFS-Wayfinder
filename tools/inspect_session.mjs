import fs from 'node:fs';
import zlib from 'node:zlib';

const F = 'C:/Users/86134/.dsh/sessions/--C-Users-86134-Desktop-gdufs--/session-20216324-5b87-4839-be75-b66fc9c60cbd/session.v4.jsonl.zstd';
const buf = zlib.zstdDecompressSync(fs.readFileSync(F));
const text = buf.toString('utf8');
const lines = text.split('\n').filter(Boolean);
console.log('decompressed bytes', buf.length, 'lines', lines.length);

const kinds = {};
for (const l of lines) {
  try {
    const o = JSON.parse(l);
    const k = o.type || o.kind || o.role || Object.keys(o).slice(0, 3).join(',');
    kinds[k] = (kinds[k] || 0) + 1;
  } catch (e) { kinds['parse-error'] = (kinds['parse-error'] || 0) + 1; }
}
console.log('kinds', kinds);

console.log('--- 第一行（截断 600 字）---');
console.log(lines[0].slice(0, 600));
console.log('--- 第二个非空行（截断 400 字）---');
console.log((lines[1] || '').slice(0, 400));
