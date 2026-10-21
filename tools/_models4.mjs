import { openDify } from './dify-lib.mjs';
const { api, close } = await openDify(9373);
try {
  const P = 'langgenius/openai_api_compatible/openai_api_compatible';
  const r = await api('/console/api/workspaces/current/models/model-types/llm');
  for (const p of (r.body && r.body.data) || []) {
    console.log('provider:', p.provider);
    for (const m of p.models || []) console.log('   -', m.model, m.status);
  }
  const one = await api(`/console/api/workspaces/current/model-providers/${P}/models?model_type=llm`);
  console.log('llm only:', one.status, JSON.stringify((one.body && one.body.data || []).map(x => x.model)));
} finally { await close(); }
