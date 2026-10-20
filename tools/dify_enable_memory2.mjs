import { openDify } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const appId = fs.readFileSync(`${OUT}/app-id.txt`, 'utf8').trim();

const { api, close } = await openDify(9379);
try {
  const draft = await api(`/console/api/apps/${appId}/workflows/draft`);
  console.log('get draft:', draft.status, 'hash:', draft.body?.hash);
  const g = draft.body?.graph;
  for (const n of g.nodes) {
    const d = n.data || {};
    if (d.type === 'llm') {
      d.memory = { role_prefix: { assistant: '', user: '' }, window: { enabled: true, size: 10 } };
    }
  }
  const save = await api(`/console/api/apps/${appId}/workflows/draft`, {
    method: 'POST',
    body: { graph: g, features: draft.body.features, hash: draft.body.hash },
  });
  console.log('save:', save.status, JSON.stringify(save.body).slice(0, 300));
  if (save.status === 200) {
    const pub = await api(`/console/api/apps/${appId}/workflows/publish`, {
      method: 'POST',
      body: { marked_name: '', marked_comment: '开启多轮记忆' },
    });
    console.log('publish:', pub.status, JSON.stringify(pub.body).slice(0, 200));
  }
} finally {
  await close();
}
