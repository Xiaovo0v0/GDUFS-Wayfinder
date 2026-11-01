// Minimal Chrome DevTools Protocol driver (no npm deps, Node 22+ global WebSocket).
// Usage: import { Browser } from './cdp.mjs'
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { decodePng, encodePng, countTransparent, composeOver } from './png.mjs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Playwright 自带的 chromium headless shell：在受限沙箱里它是唯一能稳定起来的
// （完整版 chrome/edge 会因 crashpad 拿不到句柄而 self-terminate）。
function findHeadlessShell() {
  const roots = [
    path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright'),
  ];
  for (const root of roots) {
    let dirs = [];
    try { dirs = fs.readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')); } catch { continue; }
    for (const d of dirs) {
      const base = path.join(root, d);
      const stack = [base];
      while (stack.length) {
        const cur = stack.pop();
        let ents = [];
        try { ents = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
        for (const e of ents) {
          const p = path.join(cur, e.name);
          if (e.isDirectory()) stack.push(p);
          else if (e.name === 'chrome-headless-shell.exe' || e.name === 'headless_shell.exe') return p;
        }
      }
    }
  }
  return null;
}

function pickBrowser() {
  if (process.env.GDUFS_BROWSER && fs.existsSync(process.env.GDUFS_BROWSER)) {
    return { exe: process.env.GDUFS_BROWSER, shell: /headless[-_]shell/i.test(process.env.GDUFS_BROWSER) };
  }
  const hs = findHeadlessShell();
  if (hs) return { exe: hs, shell: true };
  if (fs.existsSync(EDGE)) return { exe: EDGE, shell: false };
  return { exe: CHROME, shell: false };
}

async function httpJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('CDP endpoint not reachable: ' + url);
}

export class Browser {
  constructor(opts = {}) {
    this.port = opts.port || 9222;
    this.profile = opts.profile || path.resolve('C:/Users/86134/Desktop/gdufs/.browser-profile');
    this.visible = !!opts.visible;
    this.attachOnly = !!opts.attach; // 连已在跑的调试端口，不自己拉进程
    this.proc = null;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.sessionId = null;
  }

  async launch(url = 'about:blank') {
    fs.mkdirSync(this.profile, { recursive: true });
    const pick = pickBrowser();
    const exe = pick.exe;
    const shell = pick.shell; // headless shell 自己就是 headless，不能再传 --headless=new
    const args = [
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.profile}`,
      '--no-first-run',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-breakpad',
      '--disable-crash-reporter',
      '--no-default-browser-check',
      '--disable-features=Translate,OptimizationHints',
      '--window-size=1600,1000',
      ...(this.visible || shell ? [] : ['--headless=new', '--disable-gpu']),
      url,
    ];
    if (!this.attachOnly) {
      this.proc = spawn(exe, args, { stdio: 'ignore', detached: false });
    }
    let ver;
    try {
      ver = await httpJson(`http://127.0.0.1:${this.port}/json/version`);
    } catch (e) {
      // 某些沙箱会拦掉子进程建命名管道（Edge 起不来）。退一步用 PowerShell
      // Start-Process 起（它不走 node 的进程树），再连。
      if (this.attachOnly) throw e;
      try {
        const q = args.map((a) => `'${String(a).replace(/'/g, "''")}'`).join(',');
        spawn('powershell', ['-NoProfile', '-Command',
          `Start-Process -FilePath '${exe}' -ArgumentList ${q} -WindowStyle Hidden`],
          { stdio: 'ignore', detached: true }).unref();
        await sleep(2500);
        ver = await httpJson(`http://127.0.0.1:${this.port}/json/version`);
      } catch (e2) {
        throw new Error('浏览器起不来：' + (e2.message || e2) +
          '\n如果是沙箱环境，先手动开：msedge --remote-debugging-port=' + this.port +
          ' --user-data-dir=... --headless=new --no-sandbox，再用 {attach:true} 连。');
      }
    }
    this.wsUrl = ver.webSocketDebuggerUrl;
    await this.connect();
    await this.send('Target.setDiscoverTargets', { discover: true });
    const targets = await this.send('Target.getTargets');
    let page = targets.targetInfos.find((t) => t.type === 'page' && t.url.includes('172.17.1.46'))
      || targets.targetInfos.find((t) => t.type === 'page');
    if (!page) {
      const { targetId } = await this.send('Target.createTarget', { url });
      page = { targetId };
    }
    const { sessionId } = await this.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    this.sessionId = sessionId;
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Page.navigate', { url });
    return this;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(new Error('ws error ' + e.message));
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(JSON.stringify(msg.error)));
          else res(msg.result);
        } else if (msg.method) {
          this.events.push(msg);
        }
      };
    });
  }

  send(method, params = {}, timeoutMs = 60000) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (this.sessionId && !method.startsWith('Target.')) payload.sessionId = this.sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('timeout ' + method)); }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify(payload));
    });
  }

  async goto(url, waitMs = 2500) {
    await this.send('Page.navigate', { url });
    await sleep(waitMs);
  }

  async eval(expression, { awaitPromise = true, returnByValue = true } = {}) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue,
      userGesture: true,
    });
    if (r.exceptionDetails) {
      throw new Error('eval exception: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    }
    return r.result?.value;
  }

  async waitFor(jsExpr, timeoutMs = 20000, interval = 300) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try {
        if (await this.eval(`!!(${jsExpr})`, { awaitPromise: false })) return true;
      } catch { /* ignore */ }
      await sleep(interval);
    }
    return false;
  }

  // 截图。注意：**没有 GPU 的机器（软件光栅）上，这个调用会静默丢块** ——
  // fixed 不透明浮层（#panel/#topbar/#bcard…）下方的像素会变成 alpha=0，
  // 浏览器不报错，PNG 看起来"就是少了些东西"。换 Edge、换 headless shell、
  // 换 captureScreenshot 参数（captureBeyondViewport / fromSurface…
  // 其中 fromSurface:false 会把整页截成空白）都修不掉。
  // 需要完整画面请用 `node tools/shot.mjs --compose`（截两张再合成）。
  // 这里不做自动补洞：本类保持无依赖、无像素假设，检测留给调用方
  // （tools/png.mjs 的 countTransparent）。
  async shot(file, { fullPage = false } = {}) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let params = { format: 'png', captureBeyondViewport: fullPage };
    if (fullPage) {
      const m = await this.send('Page.getLayoutMetrics');
      const w = Math.ceil(m.cssContentSize.width), h = Math.ceil(m.cssContentSize.height);
      params.clip = { x: 0, y: 0, width: w, height: Math.min(h, 8000), scale: 1 };
      params.captureBeyondViewport = true;
    }
    const r = await this.send('Page.captureScreenshot', params);
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }

  // 补洞版截图（shot 的完整版）：① 正常截 ② 用 CSS 藏掉浮层截纯场景
  // ③ 把场景补进 ① 的透明处。软件渲染下 fixed 浮层下方必丢块，
  // 而 canvas 层永远是全的，所以这样拼出来才是"眼睛看到的那一帧"。
  // hide：要临时藏掉的浮层选择器。返回 { holes, size } 便于日志。
  async shotClean(file, opts = {}) {
    const hide = opts.hide || ['#topbar', '#panel', '#index', '#ai', '#compass', '#labels', '#bcard', '#walkbar'];
    const settle = opts.settle ?? 900;
    const grab = async () =>
      decodePng(Buffer.from((await this.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

    const base = await grab();
    const holes = countTransparent(base);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!holes) {
      fs.writeFileSync(file, encodePng(base));
      return { holes: 0, size: [base.width, base.height] };
    }
    await this.eval(`(() => {
      let s = document.getElementById('__compose');
      if (!s) { s = document.createElement('style'); s.id = '__compose'; document.head.appendChild(s); }
      s.textContent = ${JSON.stringify(hide.join(',') + '{display:none !important}')};
      return 1;
    })()`, { awaitPromise: false });
    await sleep(settle);
    const scene = await grab();
    fs.writeFileSync(file, encodePng(composeOver(base, scene)));
    return { holes, size: [base.width, base.height] };
  }

  async click(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  async clickSelector(sel) {
    const box = await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const r = el.getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2}; })()`, { awaitPromise: false });
    if (!box) throw new Error('selector not found: ' + sel);
    await this.click(box.x, box.y);
  }

  async type(sel, text) {
    await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) throw new Error('no el ${sel.replace(/'/g, '')}');
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.focus();
    })()`, { awaitPromise: false });
  }

  async close() {
    // 先走 CDP 的 Browser.close 让浏览器自己退，再按进程树强杀。
    // 只 kill 启动器（msedge.exe 的 stub）会留下渲染/GPU 子进程，
    // 攒多了会让下一次启动直接失败（mojo 命名管道拿不到）。
    try { await this.send('Browser.close'); } catch { /* noop */ }
    try { if (this.ws) this.ws.close(); } catch { /* noop */ }
    if (this.proc && this.proc.pid) {
      try {
        spawn('taskkill', ['/PID', String(this.proc.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch { /* noop */ }
      try { this.proc.kill(); } catch { /* noop */ }
    }
    await sleep(400);
  }
}

