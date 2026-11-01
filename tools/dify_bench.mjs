// 逐个模型跑同一批问题，量「首个流式分片」和「总时长」，判断哪个更快
//   node tools/dify_bench.mjs Qwen3.8-27B GLM-5.2
// 结束后自动切回原来的模型
import { openDify, sleep } from './dify-lib.mjs';

const PROVIDER = 'langgenius/openai_api_compatible/openai_api_compatible';
const QS = ['成绩单在哪里办？', '图书馆几点开门？'];
const candidates = process.argv.slice(2);

const { api, close } = await openDify(9375);
const apps = await api('/console/api/apps?page=1&limit=40');
const main = (apps.body?.data || []).find(a => a.mode === 'advanced-chat' && a.name.indexOf('尚行') === 0);

async function key() {
  const k = await api(`/console/api/apps/${main.id}/api-keys`);
  return (k.body?.data || [])[0]?.token;
}

async function switchTo(model) {
  const d = await api(`/console/api/apps/${main.id}/workflows/draft`);
  const g = d.body.graph;
  let n = 0;
  for (const node of g.nodes) {
    if (node.data.type !== 'llm') continue;
    node.data.model = node.data.model || {};
    node.data.model.provider = node.data.model.provider || PROVIDER;
    if (node.data.model.name !== model) { node.data.model.name = model; n++; }
  }
  if (!n) return true;
  const put = await api(`/console/api/apps/${main.id}/workflows/draft`, {
    method: 'POST', body: { graph: g, features: d.body.features, hash: d.body.hash },
  });
  if (put.status !== 200) { console.log('  切模型失败', put.status, JSON.stringify(put.body).slice(0, 160)); return false; }
  await sleep(600);
  const d2 = await api(`/console/api/apps/${main.id}/workflows/draft`);
  const p = await api(`/console/api/apps/${main.id}/workflows/publish`, { method: 'POST', body: { hash: d2.body?.hash } });
  return p.status === 200;
}

async function runOne(q, token) {
  const t0 = Date.now();
  const r = await fetch('http://172.17.1.46/v1/chat-messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ inputs: {}, query: q, response_mode: 'streaming', user: 'bench-' + Math.random().toString(36).slice(2, 8) }),
  });
  const rd = r.body.getReader(), dec = new TextDecoder('utf-8');
  let buf = '', first = null, acc = '';
  while (true) {
    const res = await rd.read();
    if (res.done) break;
    buf += dec.decode(res.value, { stream: true });
    const parts = buf.split('\n\n'); buf = parts.pop();
    for (const p of parts) {
      const line = p.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') continue;
      let ev; try { ev = JSON.parse(raw); } catch { continue; }
      if (ev.event !== 'message') continue;
      const t = String(ev.answer ?? ev.data?.answer ?? '');
      if (!t) continue;
      if (first == null) first = Date.now() - t0;
      acc += t;
    }
  }
  return { first, total: Date.now() - t0, len: acc.length, validJson: (() => { try { JSON.parse(acc.replace(/^```(?:json)?\s*|```\s*$/g, '')); return true; } catch { return false; } })(), head: acc.slice(0, 60) };
}

try {
  const before = await api(`/console/api/apps/${main.id}/workflows/draft`);
  const orig = (before.body.graph.nodes.find(n => n.data.type === 'llm')?.data.model || {}).name;
  console.log('当前模型:', orig, '\n');

  for (const m of candidates) {
    console.log(`=== ${m} ===`);
    if (!(await switchTo(m))) continue;
    const token = await key();
    for (const q of QS) {
      const r = await runOne(q, token);
      console.log(`  ${q}  首片 ${(r.first / 1000).toFixed(1)}s  总 ${(r.total / 1000).toFixed(1)}s  ${r.len} 字  JSON=${r.validJson ? '✔' : '✘'}`);
      console.log('    ', JSON.stringify(r.head));
    }
    console.log();
  }

  if (orig) { console.log('切回', orig); await switchTo(orig); }
} finally {
  await close();
}
