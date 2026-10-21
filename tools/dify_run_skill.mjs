// 试跑已导入的技能工作流（控制台 draft run，返回 SSE，这里解析出最终输出）
//   node tools/dify_run_skill.mjs <app_id> '<inputs json>'
import { openDify, rawText } from './dify-lib.mjs';

const appId = process.argv[2];
const inputs = JSON.parse(process.argv[3] || '{}');

const { b, close } = await openDify(9351);
try {
  const r = await rawText(b, `/console/api/apps/${appId}/workflows/draft/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs, files: [] }),
  });
  const lines = (r.text || '').split('\n').filter((l) => l.startsWith('data: '));
  let last = null, err = null;
  for (const l of lines) {
    try {
      const j = JSON.parse(l.slice(6));
      if (j.event === 'workflow_finished') last = j.data;
      if (j.event === 'node_finished' && j.data && j.data.status === 'failed') {
        err = (j.data.error || '').slice(0, 400) || j.data.title;
      }
    } catch { /* ignore */ }
  }
  if (err) console.log('节点报错:', err);
  if (last) {
    console.log('status', last.status);
    console.log('outputs:', JSON.stringify(last.outputs).slice(0, 1200));
    if (last.error) console.log('error:', String(last.error).slice(0, 400));
  } else {
    console.log('未解析到 workflow_finished，原始前 600 字：');
    console.log((r.text || '').slice(0, 600));
  }
} finally {
  await close();
}
