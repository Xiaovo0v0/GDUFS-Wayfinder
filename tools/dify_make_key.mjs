// 给应用创建 Service API 密钥并打印：node tools/dify_make_key.mjs <app_id>
import { openDify } from './dify-lib.mjs';

const appId = process.argv[2];
const { api, close } = await openDify(9353);
try {
  const r = await api(`/console/api/apps/${appId}/api-keys`, {
    method: 'POST',
    body: { type: 'app' },
  });
  console.log('status', r.status);
  const b = r.body || {};
  if (b.token) {
    console.log('TOKEN=' + b.token);
  } else {
    const list = await api(`/console/api/apps/${appId}/api-keys`);
    console.log('新建失败，现有密钥：', JSON.stringify(list.body).slice(0, 300));
  }
} finally {
  await close();
}
