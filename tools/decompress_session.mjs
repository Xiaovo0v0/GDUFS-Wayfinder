import fs from 'node:fs';
import zlib from 'node:zlib';

const F = 'C:/Users/86134/.dsh/sessions/--C-Users-86134-Desktop-gdufs--/session-20216324-5b87-4839-be75-b66fc9c60cbd/session.v4.jsonl.zstd';

const inp = fs.createReadStream(F);
const dec = zlib.createZstdDecompress();
let out = '';
inp.pipe(dec);
dec.on('data', (c) => { out += c.toString('utf8'); });
await new Promise((res, rej) => { dec.on('end', res); dec.on('error', rej); inp.on('error', rej); });

const lines = out.split('\n').filter(Boolean);
console.log('bytes', out.length, 'lines', lines.length);
const kinds = {};
for (const l of lines) {
  try { const o = JSON.parse(l); const k = o.type || '?'; kinds[k] = (kinds[k] || 0) + 1; }
  catch { kinds['bad'] = (kinds['bad'] || 0) + 1; }
}
console.log('kinds', JSON.stringify(kinds));
for (const l of lines.slice(0, 3)) console.log('---', l.slice(0, 300));
fs.writeFileSync('C:/Users/86134/Desktop/gdufs/artifacts/session-raw.jsonl', out, 'utf8');
