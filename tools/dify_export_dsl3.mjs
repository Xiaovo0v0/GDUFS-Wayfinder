import { openDify, rawText } from './dify-lib.mjs';
import fs from 'node:fs';

const APP = process.argv[2] || '19d80042-8b75-49ad-a01f-62b8a33fc0d4';
const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const { b, close } = await openDify(9360);
try {
  const r = await rawText(b, `/console/api/apps/${APP}/export?include_secret=false`);
  const j = JSON.parse(r.text);
  const yaml = j.data;
  fs.writeFileSync(`${OUT}/template_dsl.yml`, yaml, 'utf8');
  console.log('yaml len', yaml.length);
  // 打印节点结构与 features 段
  const lines = yaml.split('\n');
  const start = lines.findIndex(l => /^  graph:/.test(l));
  console.log('--- graph head ---');
  console.log(lines.slice(start, start + 60).join('\n'));
  console.log('--- node types ---');
  console.log(yaml.match(/type: [a-z-]+/g)?.join(', '));
} finally {
  await close();
}
