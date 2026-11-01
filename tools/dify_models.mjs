// 列出工作区可用的 LLM 模型（看有没有比 DeepSeek-V4-Flash-0731 更快的）
import { openDify } from './dify-lib.mjs';

const { api, close } = await openDify(9374);
try {
  const r = await api('/console/api/workspaces/current/models/model-types/llm');
  for (const p of r.body?.data || []) {
    console.log(`\n[${p.provider}] ${p.label || ''}  status=${p.status}`);
    for (const m of p.models || []) {
      console.log('   ', m.model, '|', m.label || '', '|', m.model_type, m.status ? 'status=' + m.status : '');
    }
  }
} finally {
  await close();
}
