// 直接打 Dify Service API：node tools/dify_ask.mjs <token> "问题" ["问题2" ...]
const token = process.argv[2];
const qs = process.argv.slice(3);

for (const q of qs) {
  const body = {
    inputs: {},
    query: q,
    response_mode: 'blocking',
    conversation_id: '',
    user: 'probe',
  };
  const t0 = Date.now();
  try {
    const r = await fetch('http://172.17.1.46/v1/chat-messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n[${r.status} ${dt}s] Q: ${q}`);
    if (j.answer) {
      console.log('A:', String(j.answer).replace(/\n/g, ' / ').slice(0, 320));
    } else {
      console.log('ERR:', JSON.stringify(j).slice(0, 300));
    }
  } catch (e) {
    console.log('网络错误', q, String(e).slice(0, 120));
  }
}
