import { openDify } from './dify-lib.mjs';
const { api, close } = await openDify(9375);
try {
  const P = 'langgenius/openai_api_compatible/openai_api_compatible';
  const c = await api(`/console/api/workspaces/current/model-providers/${P}/models/credentials?model=DeepSeek-V4-Flash-0731&model_type=llm`);
  console.log('credentials →', c.status);
  console.log(JSON.stringify(c.body, null, 1).slice(0, 1500));
} finally { await close(); }
