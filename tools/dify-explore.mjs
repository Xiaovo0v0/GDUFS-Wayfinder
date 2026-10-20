import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
fs.mkdirSync(OUT, { recursive: true });

const b = new Browser({ port: 9333, visible: false });
const api = async (path, opts = {}) => {
  try {
    const res = await b.eval(`(async () => {
      const r = await fetch(${JSON.stringify(path)}, ${JSON.stringify(opts)});
      const t = await r.text();
      let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 400); }
      return { status: r.status, body: j };
    })()`, { awaitPromise: true });
    return res;
  } catch (e) {
    return { error: String(e).slice(0, 300) };
  }
};

try {
  await b.launch('http://172.17.1.46/apps');
  await b.waitFor(`document.body.innerText.includes('工作室') || location.pathname !== '/apps'`, 30000);
  await new Promise((r) => setTimeout(r, 2500));

  const report = {};

  // 1. routes / sidebar
  report.routes = await b.eval(`(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => h && h.startsWith('/')).slice(0, 80))()`);

  // 2. public system features
  report.systemFeatures = await api('/console/api/system-features');

  // 3. apps
  report.apps = await api('/console/api/workspaces/current/apps?page=1&limit=50');

  // 4. datasets
  report.datasets = await api('/console/api/datasets?page=1&limit=50');

  // 5. tool providers (built-in + plugins)
  report.toolProviders = await api('/console/api/workspaces/current/tool-providers');
  report.builtinTools = await api('/console/api/workspaces/current/tools/builtin');

  // 6. plugins
  report.plugins = await api('/console/api/workspaces/current/plugin/list?page=1&page_size=50');

  // 7. model providers
  report.modelProviders = await api('/console/api/workspaces/current/model-providers');

  // 8. members / workspace
  report.workspace = await api('/console/api/workspaces/current');

  fs.writeFileSync(`${OUT}/explore-01.json`, JSON.stringify(report, null, 2));

  const summary = {
    routes: report.routes,
    version: report.systemFeatures?.body?.version || report.systemFeatures,
    appCount: report.apps?.body?.total ?? report.apps?.body?.data?.length ?? report.apps,
    datasetCount: report.datasets?.body?.total ?? report.datasets?.body?.data?.length,
    toolProviders: Array.isArray(report.toolProviders?.body)
      ? report.toolProviders.body.map(p => ({ name: p.name, type: p.type, label: p.label, tools: p.tools?.length }))
      : report.toolProviders,
    pluginRaw: report.plugins?.status,
    modelProviders: Array.isArray(report.modelProviders?.body)
      ? report.modelProviders.body.map(p => ({ provider: p.provider, label: p.label, models: p.models?.length, active: p.active }))
      : report.modelProviders,
    workspace: report.workspace,
  };
  console.log(JSON.stringify(summary, null, 2));

  await b.shot(`${OUT}/02_apps.png`, { fullPage: true });
} finally {
  await b.close();
}
