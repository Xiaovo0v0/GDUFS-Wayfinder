// 打印 SSE 原始事件与前几段增量文本（看流式到底用了哪个事件名）
import { openDify } from './dify-lib.mjs';

const q = process.argv[2] || '成绩单在哪里办？';
const { api, close } = await openDify(9373);
try {
  const apps = await api('/console/api/apps?page=1&limit=40');
  const main = (apps.body?.data || []).find(a => a.mode === 'advanced-chat' && a.name.indexOf('尚行') === 0);
  const keys = await api(`/console/api/apps/${main.id}/api-keys`);
  const token = (keys.body?.data || [])[0]?.token;
  const t0 = Date.now();
  const r = await fetch('http://172.17.1.46/v1/chat-messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ inputs: {}, query: q, response_mode: 'streaming', user: 'sse-' + Date.now() }),
  });
  const reader = r.body.getReader();
  const dec = new TextDecoder('utf-8');
  let buf = '', seen = {}, chunkAcc = '';
  while (true) {
    const res = await reader.read();
    if (res.done) break;
    buf += dec.decode(res.value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop();
    for (const p of parts) {
      const line = p.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') continue;
      let ev; try { ev = JSON.parse(raw); } catch { continue; }
      const k = ev.event;
      if (k === 'message') {
        const txt = String(ev.data?.answer ?? '');
        chunkAcc += txt;
        if ((seen[k] || 0) < 8) console.log(`   chunk#${seen[k] || 0} @${((Date.now() - t0) / 1000).toFixed(2)}s ${JSON.stringify(txt.slice(0, 50))}`);
      }
      if (!seen[k]) { seen[k] = 0; console.log(`${((Date.now() - t0) / 1000).toFixed(2)}s  首个 ${k}  ` + JSON.stringify(ev).slice(0, 700)); }
      seen[k]++;
    }
  }
  console.log('\n事件计数:', JSON.stringify(seen));
  console.log('拼接前 200 字:\n' + chunkAcc.slice(0, 200));
} finally {
  await close();
}
