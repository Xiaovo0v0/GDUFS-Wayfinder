// 打印草稿图的节点与连线，用于判断流式为何不生效
import { openDify } from './dify-lib.mjs';

const { api, close } = await openDify(9371);
try {
  const apps = await api('/console/api/apps?page=1&limit=40');
  const main = (apps.body?.data || []).find(a => a.mode === 'advanced-chat' && a.name.indexOf('尚行') === 0);
  const d = await api(`/console/api/apps/${main.id}/workflows/draft`);
  const g = d.body.graph;
  console.log('节点:', g.nodes.length, '边:', g.edges.length);
  for (const n of g.nodes) {
    const t = n.data.type;
    let extra = '';
    if (t === 'llm') extra = ' | ' + (n.data.prompt_template || []).filter(x => x.role === 'user').map(x => x.text.slice(0, 60)).join(' ');
    if (t === 'answer') extra = ' | ' + JSON.stringify(n.data.answer).slice(0, 120);
    if (t === 'variable-aggregator' || t === 'variable-assigner') extra = ' | ' + JSON.stringify(n.data.output_type || n.data.variables).slice(0, 200);
    console.log(` ${n.id.padEnd(14)} ${t.padEnd(22)} ${String(n.data.title || '').padEnd(16)}${extra}`);
  }
  console.log('\n边:');
  for (const e of g.edges) console.log(` ${(e.source || '').padEnd(14)} -> ${(e.target || '').padEnd(14)} ${e.sourceHandle || ''}`);
} finally {
  await close();
}
