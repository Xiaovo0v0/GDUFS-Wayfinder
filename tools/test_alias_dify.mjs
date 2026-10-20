import { openDify } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const token = fs.readFileSync(`${OUT}/api-key.txt`, 'utf8').trim();
const { api, close } = await openDify(9396);
try {
  for (const q of ['一饭怎么去二饭', '宿舍13栋到图书馆怎么走', '教C在哪']) {
    const r = await api('/v1/chat-messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { inputs: {}, query: q, response_mode: 'blocking', user: 'alias-test' },
    });
    const ans = r.body?.answer || '';
    let obj = null;
    try { obj = JSON.parse(ans.slice(ans.indexOf('{'), ans.lastIndexOf('}') + 1)); } catch (e) { /* ignore */ }
    console.log('\nQ:', q);
    console.log('  intent:', obj?.intent, '| from:', obj?.from, '| to:', obj?.to);
    console.log('  answer:', String(obj?.answer || ans).slice(0, 90));
  }
} finally {
  await close();
}
