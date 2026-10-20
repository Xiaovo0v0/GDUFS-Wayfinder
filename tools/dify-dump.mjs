import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
fs.mkdirSync(OUT, { recursive: true });
const EMAIL = '20241003008@gdufs.edu.cn';
const PASS = '19876699213';
const b = new Browser({ port: 9333, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const api = async (p, opts = {}) => b.eval(`(async () => {
  try {
    const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
    const csrf = m ? decodeURIComponent(m[1]) : '';
    const o = Object.assign({}, ${JSON.stringify(opts)});
    o.headers = Object.assign({ 'x-csrf-token': csrf }, o.headers || {});
    o.credentials = 'include';
    const r = await fetch(${JSON.stringify(p)}, o);
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { j = t.slice(0,300); }
    return { status: r.status, body: j };
  } catch (e) { return { error: String(e) }; }
})()`);

async function fillAndSubmit() {
  return b.eval(`(() => {
    const e = document.querySelector('input[name="email"]');
    const p = document.querySelector('input[name="password"]');
    if (!e || !p) return 'missing';
    const set = (el, v) => {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set(e, ${JSON.stringify(EMAIL)});
    set(p, ${JSON.stringify(PASS)});
    const btn = [...document.querySelectorAll('button')].find(x => x.type === 'submit');
    if (!btn) return 'nobutton';
    btn.click();
    return 'clicked';
  })()`, { awaitPromise: false });
}

export async function login() {
  for (let attempt = 0; attempt < 4; attempt++) {
    if ((await b.eval('location.pathname')) !== '/signin') return true;
    await b.waitFor(`document.querySelector('input[name="email"]')`, 30000);
    const r = await fillAndSubmit();
    if (r === 'missing' || r === 'nobutton') { await sleep(1500); continue; }
    const ok = await b.waitFor(`location.pathname !== '/signin'`, 30000);
    if (ok) { await sleep(3500); return true; }
  }
  return false;
}

try {
  await b.launch('http://172.17.1.46/signin');
  await sleep(2500);
  console.log('logged in:', await login(), 'path:', await b.eval('location.pathname'));

  const out = {};
  out.version = await api('/console/api/version?current_version=1.17.1');
  out.apps = await api('/console/api/apps?page=1&limit=50&name=&sort_by=last_modified');
  out.datasets = await api('/console/api/datasets?limit=50&include_all=false&keyword=&page=1');
  out.llm = await api('/console/api/workspaces/current/models/model-types/llm');
  out.embedding = await api('/console/api/workspaces/current/models/model-types/text-embedding');
  out.rerank = await api('/console/api/workspaces/current/models/model-types/rerank');
  out.providersSummary = await api('/console/api/workspaces/current/model-providers/summary');
  out.pluginTools = await api('/console/api/workspaces/current/plugin/tool/list?page=1&page_size=50&language=zh_Hans');
  out.installedToolIds = await api('/console/api/workspaces/current/plugin/installed-ids?category=tool');

  fs.writeFileSync(`${OUT}/api-dump.json`, JSON.stringify(out, null, 2));

  const brief = {
    apps: (out.apps.body?.data || []).map(a => ({ id: a.id, name: a.name, mode: a.mode, status: a.status })),
    datasets: (out.datasets.body?.data || []).map(d => ({ id: d.id, name: d.name, docs: d.document_count, words: d.word_count })),
    llm: (out.llm.body?.data || []).map(m => ({ provider: m.provider, model: m.model, status: m.status })),
    embedding: (out.embedding.body?.data || []).map(m => ({ provider: m.provider, model: m.model })),
    rerank: (out.rerank.body?.data || []).map(m => ({ provider: m.provider, model: m.model })),
    pluginTools: out.pluginTools.body,
    installedToolIds: out.installedToolIds.body,
  };
  console.log(JSON.stringify(brief, null, 2).slice(0, 12000));
} finally {
  await b.close();
}
