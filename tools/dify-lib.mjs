import { Browser } from './cdp.mjs';

const EMAIL = '20241003008@gdufs.edu.cn';
const PASS = '19876699213';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openDify(port = 9340) {
  const b = new Browser({ port, visible: false });
  await b.launch('http://172.17.1.46/signin');
  await sleep(2500);

  async function login() {
    for (let i = 0; i < 4; i++) {
      if ((await b.eval('location.pathname')) !== '/signin') return true;
      await b.waitFor(`document.querySelector('input[name="email"]')`, 30000);
      const r = await b.eval(`(() => {
        const e=document.querySelector('input[name="email"]'), p=document.querySelector('input[name="password"]');
        if(!e||!p) return 'missing';
        const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
        set(e,${JSON.stringify(EMAIL)}); set(p,${JSON.stringify(PASS)});
        const btn=[...document.querySelectorAll('button')].find(x=>x.type==='submit'); if(!btn) return 'nobutton'; btn.click(); return 'ok';
      })()`, { awaitPromise: false });
      if (r !== 'ok') { await sleep(1500); continue; }
      if (await b.waitFor(`location.pathname !== '/signin'`, 30000)) { await sleep(3500); return true; }
    }
    return false;
  }

  await login();

  // 在页面上下文里发请求（自动带 cookie + csrf）
  async function api(path, { method = 'GET', body = null, headers = {} } = {}) {
    const payload = body == null ? 'null' : JSON.stringify(body);
    return b.eval(`(async () => {
      const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
      const csrf = m ? decodeURIComponent(m[1]) : '';
      const opt = { method: ${JSON.stringify(method)}, credentials: 'include', headers: Object.assign({ 'x-csrf-token': csrf }, ${JSON.stringify(headers)}) };
      const body = ${payload};
      if (body !== null) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
      try {
        const r = await fetch(${JSON.stringify(path)}, opt);
        const t = await r.text();
        let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 500); }
        return { status: r.status, body: j };
      } catch (e) { return { status: -1, error: String(e) }; }
    })()`);
  }

  return { b, api, login, close: () => b.close() };
}

// 带 csrf 的原始请求（下载 DSL / 文件）
export async function rawText(b, path, options = {}) {
  return b.eval(`(async () => {
    const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
    const csrf = m ? decodeURIComponent(m[1]) : '';
    const res = await fetch(${JSON.stringify(path)}, Object.assign({ credentials: 'include', headers: { 'x-csrf-token': csrf } }, ${JSON.stringify(options)}));
    return { status: res.status, text: await res.text() };
  })()`);
}
