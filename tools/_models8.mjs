import { openDify } from './dify-lib.mjs';
const { api, close } = await openDify(9382);
try {
  const P = 'langgenius/openai_api_compatible/openai_api_compatible';
  const M = 'DeepSeek-V4.1-Flash-1017-w8a8';
  const CID = '01a13328-729e-7a18-bb86-76eb43818e63';
  const tries = [
    ['POST', `/console/api/workspaces/current/model-providers/${P}/models/${encodeURIComponent(M)}/credentials`, { credentials: {}, credential_id: CID }],
    ['POST', `/console/api/workspaces/current/model-providers/${P}/models/${encodeURIComponent(M)}/credentials`, { credential_id: CID }],
    ['POST', `/console/api/workspaces/current/model-providers/${P}/models`, { model: M, model_type: 'llm', credentials: {}, credential_id: CID }],
  ];
  for (const [m, p, body] of tries) {
    const r = await api(p, { method: m, body });
    console.log(m, p.split('/').slice(-1)[0], JSON.stringify(body).slice(0, 60), '→', r.status, JSON.stringify(r.body).slice(0, 160));
  }
  const c = await api(`/console/api/workspaces/current/model-providers/${P}/models/credentials?model=${encodeURIComponent(M)}&model_type=llm`);
  console.log('after:', JSON.stringify(c.body).slice(0, 200));
} finally { await close(); }
