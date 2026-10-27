// 把「四路 LLM → 汇总 → 一个回答节点」改成「每路各自接一个回答节点」，
// 这样 Dify 才能把 LLM 的输出按 token 流式推给前端（经过 variable-aggregator 就只能是整段）。
//   node tools/dify_stream_fix.mjs            # 只看计划
//   node tools/dify_stream_fix.mjs --write    # 改草稿并发布
import { openDify, sleep } from './dify-lib.mjs';

const WRITE = process.argv.includes('--write');
const MAP = { nav_llm: 'ans_nav', svc_llm: 'ans_svc', wiki_llm: 'ans_wiki', chat_llm: 'ans_chat' };

const { api, close } = await openDify(9372);
try {
  const apps = await api('/console/api/apps?page=1&limit=40');
  const main = (apps.body?.data || []).find(a => a.mode === 'advanced-chat' && a.name.indexOf('尚行') === 0);
  const d = await api(`/console/api/apps/${main.id}/workflows/draft`);
  const g = d.body?.graph;
  if (!g) { console.log('无草稿'); process.exit(1); }

  const tpl = g.nodes.find(n => n.id === 'answer');
  if (!tpl) { console.log('已经拆过（找不到 answer 节点），无需再改'); process.exit(0); }
  console.log('拆分流式改造：', g.nodes.length, '节点 /', g.edges.length, '边');
  console.log('模板 answer 节点:', JSON.stringify(tpl.data).slice(0, 200));

  const edgeTpl = g.edges.find(e => e.target === 'agg') || {};
  console.log('边模板:', JSON.stringify(edgeTpl));

  for (const [llm, ansId] of Object.entries(MAP)) {
    const ln = g.nodes.find(n => n.id === llm);
    if (!ln) { console.log('缺节点', llm); continue; }
    const node = JSON.parse(JSON.stringify(tpl));
    node.id = ansId;
    node.data.answer = `{{#${llm}.text#}}`;
    node.data.title = '回答';
    node.position = { x: (ln.position?.x ?? 0) + 320, y: ln.position?.y ?? 0 };
    if (g.nodes.some(n => n.id === ansId)) console.log('  已存在', ansId);
    else { g.nodes.push(node); console.log('  + 节点', ansId, '→', node.data.answer); }
  }

  const edges = [];
  for (const e of g.edges) {
    if (e.target === 'agg') {
      const to = MAP[e.source];
      if (to) {
        const ne = JSON.parse(JSON.stringify(e));
        ne.target = to;
        ne.id = `${e.source}-${to}`;
        if (ne.data) ne.data.targetType = 'answer';
        edges.push(ne);
        console.log('  边', e.source, '->', to);
      }
      continue;
    }
    if (e.source === 'agg') continue;
    if (e.target === 'answer') continue;
    edges.push(e);
  }
  g.edges = edges;
  g.nodes = g.nodes.filter(n => n.id !== 'agg' && n.id !== 'answer');
  console.log('改后:', g.nodes.length, '节点 /', g.edges.length, '边');

  if (!WRITE) { console.log('\n（只打计划，加 --write 才写回）'); process.exit(0); }

  const put = await api(`/console/api/apps/${main.id}/workflows/draft`, {
    method: 'POST',
    body: { graph: g, features: d.body.features, hash: d.body.hash },
  });
  console.log('保存草稿:', put.status, JSON.stringify(put.body).slice(0, 200));
  if (put.status !== 200) process.exit(1);
  await sleep(800);
  const d2 = await api(`/console/api/apps/${main.id}/workflows/draft`);
  const p = await api(`/console/api/apps/${main.id}/workflows/publish`, { method: 'POST', body: { hash: d2.body?.hash } });
  console.log('发布:', p.status, JSON.stringify(p.body).slice(0, 160));
} finally {
  await close();
}
