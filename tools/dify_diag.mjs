// 诊断：为什么「几个校门」答不了、为什么变慢
// node tools/dify_diag.mjs
import { openDify, sleep } from './dify-lib.mjs';

const { api, close } = await openDify(9367);
try {
  // 1. 找主应用
  const apps = await api('/console/api/apps?page=1&limit=40');
  const list = (apps.body?.data || []);
  console.log('应用列表:', list.map(a => `${a.name}(${a.mode}:${a.id.slice(0, 8)})`).join(' | '));
  const main = list.find(a => a.mode === 'advanced-chat') || list[0];
  console.log('\n主应用:', main?.name, main?.id, main?.mode);

  // 2. API key
  const keys = await api(`/console/api/apps/${main.id}/api-keys`);
  const token = (keys.body?.data || [])[0]?.token;
  console.log('api key:', token ? token.slice(0, 14) + '...' : 'NONE');

  // 3. 工作流结构（草稿）+ 节点提示词摘要
  const wf = await api(`/console/api/apps/${main.id}/workflows/draft`);
  const g = wf.body?.graph?.nodes || [];
  console.log('\n节点 %d 个：' % g.length);
  for (const n of g) {
    const d = n.data || {};
    console.log(`  - ${d.type}/${d.title || ''}  (id ${n.id.slice(0, 8)})`);
  }

  // 4. 实测问答
  const qs = ['广外有几个校门？', '南校区有几个校门，分别叫什么？', '成绩单在哪里办？', '图书馆几点开门？'];
  for (const q of qs) {
    const t0 = Date.now();
    const r = await api('/v1/chat-messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { inputs: {}, query: q, response_mode: 'blocking', user: 'diag-' + Date.now() },
    });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    const a = r.body?.answer;
    console.log(`\n[${dt}s] Q: ${q}`);
    console.log('   A:', String(a || JSON.stringify(r.body)).replace(/\n/g, ' ⏎ ').slice(0, 400));
  }

  // 5. 最近几次运行的节点耗时
  await sleep(1500);
  const runs = await api(`/console/api/apps/${main.id}/workflow-runs?page=1&limit=3`);
  for (const run of (runs.body?.data || [])) {
    const detail = await api(`/console/api/apps/${main.id}/workflow-runs/${run.id}`);
    const nodes = detail.body?.graph?.nodes || [];
    const total = Number(run.elapsed_time || 0).toFixed(2);
    console.log(`\n运行 ${run.id.slice(0, 8)}  总 ${total}s  ${run.status}  Q=${(run.inputs || '').slice(0, 40)}`);
    const rows = nodes.map(n => ({
      t: (n.data?.title || n.data?.type || '?'),
      ms: Number(n.execution_metadata?.elapsed_time || 0),
      st: n.execution_metadata?.status || '',
    })).sort((a, b) => b.ms - a.ms).slice(0, 8);
    for (const r2 of rows) console.log(`   ${r2.ms.toFixed(2).padStart(7)}s  ${r2.st.padEnd(9)} ${r2.t}`);
  }
} finally {
  await close();
}
