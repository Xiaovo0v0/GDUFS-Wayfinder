// 给 Chatflow 的「生成回答」LLM 节点开启记忆窗口（多轮上下文）
import { openDify } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const appId = fs.readFileSync(`${OUT}/app-id.txt`, 'utf8').trim();

const { api, close } = await openDify(9378);
try {
  const draft = await api(`/console/api/apps/${appId}/workflows/draft`);
  console.log('get draft:', draft.status);
  const g = draft.body?.graph;
  if (!g) throw new Error('no graph');

  let changed = 0;
  for (const n of g.nodes) {
    const d = n.data || {};
    if (d.type === 'llm') {
      d.memory = d.memory || {};
      d.memory.window = d.memory.window || {};
      d.memory.window.enabled = true;
      d.memory.window.size = 10;
      d.memory.role_prefix = d.memory.role_prefix || { assistant: '', user: '' };
      changed++;
    }
  }
  console.log('llm nodes updated:', changed);

  const save = await api(`/console/api/apps/${appId}/workflows/draft`, {
    method: 'POST',
    body: { graph: g, features: draft.body.features },
  });
  console.log('save:', save.status, JSON.stringify(save.body).slice(0, 200));

  const pub = await api(`/console/api/apps/${appId}/workflows/publish`, {
    method: 'POST',
    body: { marked_name: '', marked_comment: '开启多轮记忆' },
  });
  console.log('publish:', pub.status, JSON.stringify(pub.body).slice(0, 200));
} finally {
  await close();
}
