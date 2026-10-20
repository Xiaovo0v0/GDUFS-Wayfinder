import { openDify } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const token = fs.readFileSync(`${OUT}/api-key.txt`, 'utf8').trim();
const { api, close } = await openDify(9380);
try {
  const ask = async (q, conv) => {
    const r = await api('/v1/chat-messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { inputs: {}, query: q, response_mode: 'blocking', user: 'mt-test', conversation_id: conv || '' },
    });
    return r.body;
  };
  const r1 = await ask('从文采园怎么去图书馆？');
  console.log('A1:', String(r1.answer).slice(0, 200));
  const conv = r1.conversation_id;
  console.log('conv:', conv);
  const r2 = await ask('那从图书馆再去二饭呢？', conv);
  console.log('\nA2:', String(r2.answer).slice(0, 260));
} finally {
  await close();
}
