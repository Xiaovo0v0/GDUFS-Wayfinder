import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9333, visible: false });
try {
  await b.launch('http://172.17.1.46/signin');
  await new Promise((r) => setTimeout(r, 2500));
  const r = await b.eval(`(async () => {
    const out = {};
    try {
      const a = await fetch('https://marketplace.dify.ai/api/v1/plugins/search/basic?page=1&page_size=3&query=map', { signal: AbortSignal.timeout(8000) });
      out.marketplace = a.status;
    } catch (e) { out.marketplace = 'ERR ' + e.message; }
    try {
      const c = await fetch('https://www.gdufs.edu.cn/', { signal: AbortSignal.timeout(8000) });
      out.gdufs = c.status;
    } catch (e) { out.gdufs = 'ERR ' + e.message; }
    return out;
  })()`);
  console.log(JSON.stringify(r, null, 2));
} finally {
  await b.close();
}
