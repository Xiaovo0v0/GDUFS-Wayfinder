// Minimal Chrome DevTools Protocol driver (no npm deps, Node 22+ global WebSocket).
// Usage: import { Browser } from './cdp.mjs'
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    this.proc = null;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.sessionId = null;
  }

  async launch(url = 'about:blank') {
    fs.mkdirSync(this.profile, { recursive: true });
    const exe = fs.existsSync(EDGE) ? EDGE : CHROME;
    const args = [
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate,OptimizationHints',
      '--window-size=1600,1000',
      ...(this.visible ? [] : ['--headless=new', '--disable-gpu']),
      url,
    ];
    this.proc = spawn(exe, args, { stdio: 'ignore', detached: false });
    const ver = await httpJson(`http://127.0.0.1:${this.port}/json/version`);
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
    try { if (this.ws) this.ws.close(); } catch { /* noop */ }
    try { if (this.proc) this.proc.kill(); } catch { /* noop */ }
  }
}
