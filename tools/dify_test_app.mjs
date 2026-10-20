import { openDify, sleep } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const appId = fs.readFileSync(`${OUT}/app-id.txt`, 'utf8').trim();
const { api, close } = await openDify(9363);
try {
  // 站点信息 / WebApp URL
  const site = await api(`/console/api/apps/${appId}/site`);
  console.log('site:', site.status, JSON.stringify(site.body).slice(0, 300));

  // API 密钥
  const keys = await api(`/console/api/apps/${appId}/api-keys`);
  let token = (keys.body?.data || [])[0]?.token;
  if (!token) {
    const created = await api(`/console/api/apps/${appId}/api-keys`, { method: 'POST', body: { type: 'api' } });
    console.log('create key:', created.status, JSON.stringify(created.body).slice(0, 200));
    token = created.body?.token;
  }
  console.log('token:', token ? token.slice(0, 12) + '...' : 'NONE');
  if (token) fs.writeFileSync(`${OUT}/api-key.txt`, token, 'utf8');

  // 测试三次
  const qs = [
    '从文采园怎么去图书馆？',
    '成绩单在哪里办？需要带什么？',
    '图书馆几层？第一饭堂几点开门？',
  ];
  for (const q of qs) {
    const r = await api('/v1/chat-messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { inputs: {}, query: q, response_mode: 'blocking', user: 'probe-1' },
    });
    console.log('\nQ:', q);
    console.log('status:', r.status);
    const ans = r.body?.answer;
    console.log('A:', typeof ans === 'string' ? ans.slice(0, 700) : JSON.stringify(r.body).slice(0, 400));
  }
} finally {
  await close();
}
