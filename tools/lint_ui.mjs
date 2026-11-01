// 界面体检：node tools/lint_ui.mjs [选项]
//   --dir gdufs-3d          要服务的目录（默认 gdufs-3d，仓库内没有依赖）
//   --w 1440 --h 900        视口（默认同时跑 1440x900 与 390x844）
//   --only 1440x900         只听一个视口
//   --min-fs 13             成句文字小于这个字号只提示（默认 13）
//   --min-fs-fail 8         小于这个字号算失败（默认 8，绝对读不清）
//   --strict                把「成句文字小于 --min-fs」也算失败
//   --no-setup              不自动选起终点（不展开路线结果）
//
// 为什么：这个项目的界面靠眼睛验收，字号和对比度没有自动兜底。手改一通 CSS
// 之后最容易发生的不是白屏，而是「数字看不清 / 灰字压在灰底上」这种没人报错
// 的退化。改完 CSS 或 HTML 跑一次，看输出里有没有 ✗。
//
// 退出码：0 通过 / 1 有失败项 / 2 起不来。

import { Browser } from './cdp.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);

const ROOT = path.resolve(argOf('--dir', 'gdufs-3d'));
const MIN_FS = Number(argOf('--min-fs', '13'));
const MIN_FS_FAIL = Number(argOf('--min-fs-fail', '8'));
const STRICT = has('--strict');
const SETUP = !has('--no-setup');
const only = argOf('--only', '');
const VIEWPORTS = (only ? [only] : ['1440x900', '390x844']).map((s) => {
  const [w, h] = s.split('x').map(Number);
  return { name: s, w, h, mobile: w < 600 };
});

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.ktx2': 'image/ktx2', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm',
};

function serve(dir) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(dir, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
    fs.stat(file, (err, st) => {
      if (!err && st.isDirectory()) file = path.join(file, 'index.html');
      fs.readFile(file, (e, buf) => {
        if (e) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404 ' + rel); return; }
        res.writeHead(200, {
          'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'cache-control': 'no-store',
        });
        res.end(buf);
      });
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ---- 在被测页面里跑的审计函数（会被 toString 后注入，不能引用外部变量）----
function auditDom(opts) {
  const { minFs } = opts;

  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || '');
    if (!m) return null;
    const p = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? p[3] : 1];
  };
  const over = (top, base) => {
    const a = top[3];
    return [0, 1, 2].map((i) => Math.round(top[i] * a + base[i] * (1 - a))).concat(1);
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const contrast = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const bgOf = (el) => {
    const stack = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const st = getComputedStyle(node);
      const c = parse(st.backgroundColor);
      if (c && c[3] > 0) {
        stack.push(c);
        if (c[3] >= 0.999) break;
      }
      node = node.parentElement;
    }
    let base = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  };
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else {
      const cls = (el.className && typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
    }
    return s;
  };

  const violations = []; // 对比度不足
  const tiny = [];       // 字号小于失败线（默认 8px，绝对读不清）
  const longSmall = [];  // 成句文字却小于提示线（默认 13px），短标签不算
  const sizes = {};

  const all = document.querySelectorAll('body *');
  for (const el of all) {
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent;
    own = own.replace(/\s+/g, ' ').trim();
    if (!own) continue;

    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
    if (el.closest('#labels')) continue; // canvas 里的标签不是 DOM 文本
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;

    const fs = parseFloat(st.fontSize) || 0;
    const weight = Number(st.fontWeight) || 400;
    sizes[fs] = (sizes[fs] || 0) + 1;

    const fg0 = parse(st.color) || [0, 0, 0, 1];
    const bg = bgOf(el);
    const fg = fg0[3] < 1 ? over(fg0, bg) : fg0;
    const cr = contrast(fg, bg);
    const large = fs >= 24 || (fs >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;

    const item = {
      sel: sel(el), fs: Math.round(fs * 10) / 10, weight,
      ratio: Math.round(cr * 100) / 100, need, text: own.slice(0, 40),
      fg: 'rgb(' + fg.slice(0, 3).join(',') + ')',
      bg: 'rgb(' + bg.slice(0, 3).join(',') + ')',
    };
    if (cr + 0.005 < need) violations.push(item);
    // 短标签（「北」「R-01」「/ FROM」）在这个设计语言里允许小；成句文字不允许。
    if (fs < opts.failFs) tiny.push(item);
    else if (fs < minFs && own.length >= 12) longSmall.push(item);
  }
  return { violations, tiny, longSmall, sizes };
}

// ---- 主流程 ----
const agg = new Map(); // key -> { ...item, ratioMin, count, views:Set }

function absorb(list, view, keyPrefix) {
  for (const it of list) {
    const key = keyPrefix + '|' + it.sel + '|' + it.fs + '|' + it.need;
    const cur = agg.get(key);
    if (cur) {
      cur.count++;
      cur.views.add(view);
      if (it.ratio < cur.ratio) cur.ratio = it.ratio;
      if (!cur.text) cur.text = it.text;
    } else {
      agg.set(key, { ...it, count: 1, views: new Set([view]) });
    }
  }
}

const server = await serve(ROOT);
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/`;
console.log(`界面体检 ${ROOT}  →  ${baseUrl}`);

const b = new Browser({ port: 9334 });
let failed = false;
try {
  await b.launch('about:blank');
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });

  for (const vp of VIEWPORTS) {
    await b.send('Emulation.setDeviceMetricsOverride', {
      width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile,
    });
    await b.send('Page.navigate', { url: baseUrl });
    await b.eval('location.reload(true)', { awaitPromise: false }).catch(() => {});
    await b.waitFor('document.querySelector("#app canvas")', 20000).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    if (SETUP) {
      await b.eval(`(() => { try { window.__navDebug && window.__navDebug.setPlaces && window.__navDebug.setPlaces('文采园（第一饭堂）','图书馆'); } catch (e) {} return 1; })()`, { awaitPromise: false }).catch(() => {});
      await new Promise((r) => setTimeout(r, 800));
    }
    const res = await b.eval(`(${auditDom.toString()})(${JSON.stringify({ minFs: MIN_FS, failFs: MIN_FS_FAIL })})`);
    const bad = res.violations.filter((x) => x.ratio + 0.005 < x.need);
    const tiny = res.tiny;
    const longSmall = res.longSmall;
    absorb(bad, vp.name, 'contrast');
    absorb(tiny, vp.name, 'tiny');
    if (STRICT) absorb(longSmall, vp.name, 'small');
    if (bad.length || tiny.length || (STRICT && longSmall.length)) failed = true;

    const hist = Object.entries(res.sizes).sort((a, b2) => Number(a[0]) - Number(b2[0]))
      .map(([fs, n]) => `${fs}px×${n}`).join('  ');
    console.log(`\n[${vp.name}] 文本节点 ${Object.values(res.sizes).reduce((a, c) => a + c, 0)} 个`);
    console.log(`  字号分布: ${hist}`);
    if (bad.length) {
      console.log(`  ✗ 对比度不足 ${bad.length} 处：`);
      for (const v of bad.slice(0, 12)) {
        console.log(`    ${v.sel}  ${v.fs}px  ${v.ratio}:1 < ${v.need}:1  fg=${v.fg} bg=${v.bg}  「${v.text}」`);
      }
      if (bad.length > 12) console.log(`    … 另有 ${bad.length - 12} 处`);
    } else {
      console.log('  ✓ 对比度全部达标');
    }
    if (tiny.length) {
      console.log(`  ✗ 字号小于 ${MIN_FS_FAIL}px（读不清）${tiny.length} 处：`);
      for (const v of tiny.slice(0, 8)) console.log(`    ${v.sel}  ${v.fs}px  「${v.text}」`);
    } else {
      console.log(`  ✓ 没有小于 ${MIN_FS_FAIL}px 的文本`);
    }
    if (longSmall.length) {
      console.log(`  ${STRICT ? '✗' : '⚠'} 成句文字小于 ${MIN_FS}px ${longSmall.length} 处${STRICT ? '' : '（仅提示）'}：`);
      for (const v of longSmall.slice(0, 8)) console.log(`    ${v.sel}  ${v.fs}px  「${v.text}」`);
    }
  }
} finally {
  await b.close();
  server.close();
}

// 跨视口汇总（同一元素在两个视口都出问题只算一条）
const rows = [...agg.values()].filter((r) => r.views.size >= 1);
console.log('\n' + '─'.repeat(60));
if (!rows.length) {
  console.log('界面体检 ✓ 没有失败项');
  process.exit(0);
}
console.log(`界面体检 ✗ 汇总 ${rows.length} 条（详见上面的分视口明细）`);
process.exit(1);
