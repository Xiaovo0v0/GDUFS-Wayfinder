// 把 skills/dsl/*.yml 导入 Dify，并尝试发布为可被调用的工具
//   node tools/dify_import_skill.mjs route-calc
//   node tools/dify_import_skill.mjs all
import fs from 'node:fs';
import path from 'node:path';
import { openDify, sleep } from './dify-lib.mjs';

const REPO = 'C:/Users/86134/Desktop/gdufs';
const DSL_DIR = path.join(REPO, 'skills/dsl');

const target = process.argv[2] || 'route-calc';
const files = target === 'all'
  ? fs.readdirSync(DSL_DIR).filter((f) => f.endsWith('.yml'))
  : [`${target}.yml`];

const { api, close } = await openDify(9350);
try {
  for (const f of files) {
    const yaml = fs.readFileSync(path.join(DSL_DIR, f), 'utf8');
    console.log(`\n=== 导入 ${f} (${(yaml.length / 1024).toFixed(1)} KB) ===`);

    const r = await api('/console/api/apps/imports', {
      method: 'POST',
      body: { mode: 'yaml-content', yaml_content: yaml, app_import_id: null },
    });
    console.log('status', r.status);
    const body = r.body || {};
    const info = body.app_import_id ? body : (body.imported_dsl_version ? body : body);
    if (r.status !== 200 && r.status !== 201) {
      console.log('返回', JSON.stringify(body).slice(0, 400));
      continue;
    }
    const appId = body.app_id || (body.app && body.app.id) || body.id;
    console.log('app_id', appId, 'import_id', body.app_import_id || '-');

    if (!appId) { console.log('返回', JSON.stringify(body).slice(0, 400)); continue; }

    // 发布：先取 draft 的 hash
    const d = await api(`/console/api/apps/${appId}/workflows/draft`);
    console.log('draft status', d.status, 'hash', d.body && d.body.hash);
    const hash = d.body && d.body.hash;
    const p = await api(`/console/api/apps/${appId}/workflows/publish`, {
      method: 'POST',
      body: hash ? { hash } : {},
    });
    console.log('publish status', p.status, JSON.stringify(p.body).slice(0, 200));
    await sleep(800);
  }
} finally {
  await close();
}
