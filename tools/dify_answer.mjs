// 打印几个问题的完整回答：node tools/dify_answer.mjs "问题1" "问题2"
import { openDify } from './dify-lib.mjs';

const qs = process.argv.slice(2);
const { api, close } = await openDify(9370);
try {
  const apps = await api('/console/api/apps?page=1&limit=40');
  const main = (apps.body?.data || []).find(a => a.mode === 'advanced-chat' && a.name.indexOf('尚行') === 0);
  const keys = await api(`/console/api/apps/${main.id}/api-keys`);
  const token = (keys.body?.data || [])[0]?.token;
  for (const q of qs) {
    const t0 = Date.now();
    const r = await api('/v1/chat-messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { inputs: {}, query: q, response_mode: 'blocking', user: 'ans-' + Date.now() },
    });
    console.log(`\n[${((Date.now() - t0) / 1000).toFixed(1)}s] ${q}`);
    console.log(String(r.body?.answer ?? JSON.stringify(r.body)).slice(0, 900));
  }
} finally {
  await close();
}
