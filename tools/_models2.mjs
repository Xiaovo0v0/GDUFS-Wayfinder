import { openDify } from './dify-lib.mjs';
const { api, close } = await openDify(9371);
try {
  const P = 'langgenius/openai_api_compatible/openai_api_compatible';
  const a = await api(`/console/api/workspaces/current/model-providers/${P}/models`);
  console.log('models endpoint:', a.status, JSON.stringify(a.body).slice(0, 400));
  const b = await api(`/console/api/workspaces/current/model-providers/${P}`);
  console.log('provider:', b.status, JSON.stringify(b.body).slice(0, 600));
} finally { await close(); }
