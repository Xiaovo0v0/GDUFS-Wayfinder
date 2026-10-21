import { openDify } from './dify-lib.mjs';
const { api, close } = await openDify(9386);
try {
  const r = await api('/console/api/apps/0dba8b7c-f276-408f-8e1a-86532d833333', { method: 'DELETE' });
  console.log('delete qwen test app →', r.status);
} finally { await close(); }
