import { openDify } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const appId = fs.readFileSync(`${OUT}/app-id.txt`, 'utf8').trim();
const { api, close } = await openDify(9364);
try {
  const detail = await api(`/console/api/apps/${appId}`);
  const s = JSON.stringify(detail.body);
  console.log('app detail status', detail.status, 'len', s.length);
  const tokens = s.match(/"site_[a-z_]*":"?[^",]+/g);
  console.log('site fields:', tokens);
  console.log(s.slice(0, 700));

  for (const p of [
    `/console/api/apps/${appId}/site-enable`,
    `/console/api/apps/${appId}/access-point`,
    `/console/api/apps/${appId}/webapp`,
  ]) {
    const r = await api(p);
    console.log(p, '->', r.status, JSON.stringify(r.body).slice(0, 200));
  }
} finally {
  await close();
}
