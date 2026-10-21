import { openDify } from './dify-lib.mjs';
const { api, close } = await openDify(9374);
try {
  const P = 'langgenius/openai_api_compatible/openai_api_compatible';
  const variants = [
    { model: 'DeepSeek-V4.1-Flash-1017-w8a8', model_type: 'llm', credentials: '{"context_size":"262144","max_tokens":"8192","vision_support":"support","structured_output_support":"not_support","function_calling_type":"no_call","stream_function_calling":"not_supported","stream_mode":"streaming"}' },
    { model_name: 'DeepSeek-V4.1-Flash-1017-w8a8', model_type: 'llm', credentials: {} },
  ];
  for (const body of variants) {
    const r = await api(`/console/api/workspaces/current/model-providers/${P}/models`, { method: 'POST', body });
    console.log('variant', Object.keys(body)[0], '→', r.status, JSON.stringify(r.body).slice(0, 200));
  }
  const one = await api(`/console/api/workspaces/current/model-providers/${P}/models?model_type=llm`);
  console.log('models now:', JSON.stringify((one.body && one.body.data || []).map(x => x.model)));
} finally { await close(); }
