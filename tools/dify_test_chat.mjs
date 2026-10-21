// 试跑对话型应用（控制台接口）：node tools/dify_test_chat.mjs <app_id> "问题"
import { openDify } from './dify-lib.mjs';

const appId = process.argv[2];
const q = process.argv[3] || '你好';

const { api, close } = await openDify(9352);
try {
  const r = await api(`/console/api/apps/${appId}/chat-messages`, {
    method: 'POST',
    body: { inputs: {}, query: q, response_mode: 'blocking', conversation_id: '', files: [] },
  });
  console.log('status', r.status);
  const b = r.body || {};
  if (b.answer != null) {
    console.log('Q:', q);
    console.log('A:', String(b.answer).slice(0, 700));
  } else {
    console.log(JSON.stringify(b).slice(0, 700));
  }
} finally {
  await close();
}
