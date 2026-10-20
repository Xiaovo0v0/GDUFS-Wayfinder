import { openDify, rawText } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const apps = {
  '333_workflow': '45f6da5d-27d7-47b7-adbf-847ff2e1033d',
  'kefu_chatflow': '134fca64-daa5-4829-ac00-be830e2dc931',
};
const { b, close } = await openDify(9361);
try {
  for (const [name, id] of Object.entries(apps)) {
    const r = await rawText(b, `/console/api/apps/${id}/export?include_secret=false`);
    try {
      const yaml = JSON.parse(r.text).data;
      fs.writeFileSync(`${OUT}/dsl_${name}.yml`, yaml, 'utf8');
      console.log(name, 'ok len', yaml.length, '| types:', [...new Set(yaml.match(/^        type: .*/gm) || [])].join(' '));
    } catch (e) {
      console.log(name, 'fail', r.status, r.text.slice(0, 120));
    }
  }
} finally {
  await close();
}
