import { openDify } from './dify-lib.mjs';
const { api, close } = await openDify(9372);
try {
  const P = 'langgenius/openai_api_compatible/openai_api_compatible';
  const body = {
    model: 'DeepSeek-V4.1-Flash-1017-w8a8',
    model_type: 'llm',
    credentials: {
      context_size: '262144',
      max_tokens: '8192',
      vision_support: 'support',
      structured_output_support: 'not_support',
      function_calling_type: 'no_call',
      stream_function_calling: 'not_supported',
      stream_mode: 'streaming'
    }
  };
  const r = await api(`/console/api/workspaces/current/model-providers/${P}/models`, { method: 'POST', body });
  console.log('add →', r.status, JSON.stringify(r.body).slice(0, 400));
  const list = await api(`/console/api/workspaces/current/model-providers/${P}/models`);
  for (const m of (list.body && list.body.data) || []) console.log('  model:', m.model, m.status, JSON.stringify(m.model_properties));
} finally { await close(); }
