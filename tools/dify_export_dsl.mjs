import { openDify } from './dify-lib.mjs';
import fs from 'node:fs';

const APP = process.argv[2] || '19d80042-8b75-49ad-a01f-62b8a33fc0d4';
const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const { b, api, close } = await openDify(9357);
try {
  const r = await b.eval(`(async () => {
    const res = await fetch('/console/api/apps/${APP}/export?include_secret=false', { credentials: 'include' });
    return { status: res.status, text: await res.text() };
  })()`);
  console.log('status', r.status, 'len', r.text.length);
  fs.writeFileSync(`${OUT}/template_dsl.yml`, r.text, 'utf8');
  console.log(r.text.slice(0, 1500));
} finally {
  await close();
}
