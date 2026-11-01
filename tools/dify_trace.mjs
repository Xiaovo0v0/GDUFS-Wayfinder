// 用流式接口抓每个节点的耗时：node_started / node_finished 事件里带 elapsed_time
// node tools/dify_trace.mjs "问题1" "问题2" ...
import { openDify } from './dify-lib.mjs';

const qs = process.argv.slice(2);
const { api, close } = await openDify(9368);
try {
  const apps = await api('/console/api/apps?page=1&limit=40');
  const main = (apps.body?.data || []).find(a => a.mode === 'advanced-chat' && a.name.indexOf('尚行') === 0);
  const keys = await api(`/console/api/apps/${main.id}/api-keys`);
  const token = (keys.body?.data || [])[0]?.token;

  for (const q of qs) {
    console.log(`\n=== ${q} ===`);
    const t0 = Date.now();
    const res = await fetch('http://172.17.1.46/v1/chat-messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: {}, query: q, response_mode: 'streaming', user: 'trace-' + Date.now() }),
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const nodes = [];
    let firstTok = null, chars = 0, usage = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        const line = part.split('\n').find(l => l.startsWith('data: '));
        if (!line) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        let ev; try { ev = JSON.parse(raw); } catch { continue; }
        const d = ev.data || {};
        if (ev.event === 'node_started') nodes.push({ id: d.node_id, title: d.title, type: d.node_type, t0: Date.now() });
        if (ev.event === 'node_finished') {
          const n = nodes.find(x => x.id === d.node_id && !x.ms);
          if (n) n.ms = (Date.now() - n.t0) / 1000;
        }
        if (ev.event === 'message' || ev.event === 'agent_message') {
          if (firstTok == null) firstTok = Date.now();
          chars += String(d.answer || '').length;
        }
        if (ev.event === 'message_end' && d.metadata?.usage) {
          usage = d.metadata.usage;
        }
      }
    }
    const total = (Date.now() - t0) / 1000;
    console.log(`总 ${total.toFixed(1)}s   首字 ${firstTok ? ((firstTok - t0) / 1000).toFixed(1) : '-'}s   输出 ${chars} 字` +
      (usage ? `   tokens 入${usage.prompt_tokens}/出${usage.completion_tokens}` : ''));
    for (const n of nodes) {
      console.log(`  ${Number(n.ms || 0).toFixed(2).padStart(7)}s  ${String(n.type).padEnd(22)} ${n.title}`);
    }
  }
} finally {
  await close();
}
