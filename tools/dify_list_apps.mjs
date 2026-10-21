// 列出 Dify 上的应用：node tools/dify_list_apps.mjs
import { openDify } from './dify-lib.mjs';

const { api, close } = await openDify(9360);
try {
  const r = await api('/console/api/apps?page=1&limit=100');
  const list = (r.body && r.body.data) || [];
  console.log('共', list.length, '个应用\n');
  const rows = list.map((a) => ({
    id: a.id,
    name: a.name,
    mode: a.mode,
    updated: a.updated_at ? new Date(a.updated_at * 1000).toISOString().slice(5, 16).replace('T', ' ') : '',
  }));
  rows.sort((x, y) => (x.name === y.name ? (x.updated < y.updated ? 1 : -1) : x.name.localeCompare(y.name)));
  for (const a of rows) {
    console.log(`${a.updated}  ${a.mode.padEnd(14)}  ${a.id}  ${a.name}`);
  }
} finally {
  await close();
}
