import { openDify } from './dify-lib.mjs';
const { api, close } = await openDify(9370);
try {
  const r = await api('/console/api/workspaces/current/models/model-types/llm');
  const arr = (r.body && r.body.data) || [];
  for (const p of arr) {
    console.log('provider:', p.provider, '|', p.label && p.label.zh_Hans);
    for (const m of p.models || []) {
      console.log('   -', m.model, m.model_type, m.status);
    }
  }
} finally { await close(); }
