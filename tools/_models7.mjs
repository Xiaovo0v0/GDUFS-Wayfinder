import { openDify } from './dify-lib.mjs';
const { api, close } = await openDify(9381);
try {
  const P = 'langgenius/openai_api_compatible/openai_api_compatible';
  const M = 'DeepSeek-V4.1-Flash-1017-w8a8';
  const r = await api(`/console/api/workspaces/current/model-providers/${P}/models/credentials?model=${encodeURIComponent(M)}&model_type=llm`);
  console.log('credentials for new model →', r.status, JSON.stringify(r.body).slice(0, 300));
} finally { await close(); }
