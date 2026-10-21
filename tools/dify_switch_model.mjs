// 一键把主应用切到另一个模型（周五 DeepSeek-V4-Flash 下线时用这个）
//   node tools/dify_switch_model.mjs Qwen3.8-27B
//   node tools/dify_switch_model.mjs DeepSeek-V4.1-Flash-1017-w8a8
//
// 做的事：重新生成 DSL（换模型名）→ 导入 → 发布 → 建密钥 → 改 ai-config.js → 重打单文件
// 不做的事：删除旧应用（留给 tools/dify_cleanup.mjs，避免误删）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openDify } from './dify-lib.mjs';

const REPO = 'C:/Users/86134/Desktop/gdufs';
const model = process.argv[2];
if (!model) {
  console.error('用法：node tools/dify_switch_model.mjs <模型名>');
  process.exit(1);
}

console.log('目标模型：', model);

// 1) 重新生成 DSL
execFileSync(process.execPath, [path.join(REPO, 'tools/make_main_dsl.mjs')], {
  env: { ...process.env, GDUFS_MODEL: model },
  stdio: 'inherit',
});
const yaml = fs.readFileSync(path.join(REPO, 'skills/dsl/main-app.yml'), 'utf8');
if (!yaml.includes(`name: ${model}`)) {
  console.error('DSL 里没有出现目标模型名，生成可能失败');
  process.exit(1);
}

// 2) 导入 + 发布
const { api, close } = await openDify(9390);
try {
  const imp = await api('/console/api/apps/imports', {
    method: 'POST',
    body: { mode: 'yaml-content', yaml_content: yaml, app_import_id: null },
  });
  const appId = imp.body && imp.body.app_id;
  if (!appId) {
    console.error('导入失败：', JSON.stringify(imp.body).slice(0, 300));
    process.exit(1);
  }
  console.log('新应用：', appId);

  const d = await api(`/console/api/apps/${appId}/workflows/draft`);
  const hash = d.body && d.body.hash;
  const p = await api(`/console/api/apps/${appId}/workflows/publish`, { method: 'POST', body: hash ? { hash } : {} });
  console.log('发布：', p.status);

  const k = await api(`/console/api/apps/${appId}/api-keys`, { method: 'POST', body: { type: 'app' } });
  const token = k.body && k.body.token;
  if (!token) {
    console.error('建密钥失败：', JSON.stringify(k.body).slice(0, 200));
    process.exit(1);
  }
  console.log('新密钥：', token);

  const site = await api(`/console/api/apps/${appId}/site`, { method: 'POST' });
  const webapp = site.body && site.body.access_token;

  // 3) 改前端配置
  const cfgPath = path.join(REPO, 'gdufs-3d/ai-config.js');
  let cfg = fs.readFileSync(cfgPath, 'utf8');
  cfg = cfg
    .replace(/key:\s*"[^"]*"/, `key: "${token}"`)
    .replace(/appId:\s*"[^"]*"/, `appId: "${appId}"`)
    .replace(/model:\s*"[^"]*"/, `model: "${model}"`);
  if (!/model:/.test(cfg)) cfg = cfg.replace('appId:', `model: "${model}",\n  appId:`);
  fs.writeFileSync(cfgPath, cfg, 'utf8');
  console.log('已更新 gdufs-3d/ai-config.js');

  // 4) 重打单文件
  execFileSync(process.execPath, [path.join(REPO, 'tools/build_single_file.mjs')], { stdio: 'inherit' });

  console.log('\n完成。');
  console.log('  appId  :', appId);
  console.log('  key    :', token);
  console.log('  webapp :', webapp ? `http://172.17.1.46/chat/${webapp}` : '(未取到)');
  console.log('\n记得：① 用 tools/dify_cleanup.mjs 删掉旧应用；② 更新 docs 里的应用 ID 与链接。');
} finally {
  await close();
}
