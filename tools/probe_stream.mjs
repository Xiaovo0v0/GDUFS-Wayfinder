// 诊断：页面是否加载了最新版 UI、浏览器能不能读到流式分片
import { Browser } from './cdp.mjs';

const b = new Browser({ width: 1200, height: 800 });
await b.launch('about:blank');
try {
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.goto('http://127.0.0.1:8080/index.html?cb=' + Date.now(), 2500);
  await b.waitFor('window.__navDebug && !!window.__navDebug.mode', 30000).catch(() => {});
  console.log('uiBuild =', await b.eval('window.__uiBuild || "(装载的是旧版)"'));
  console.log('key     =', await b.eval('(window.GDUFS_AI && window.GDUFS_AI.key || "").slice(0, 14)'));

  const probe = await b.eval(`(async function(){
    var t0 = performance.now();
    var r = await fetch(window.GDUFS_AI.base + '/chat-messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + window.GDUFS_AI.key, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ inputs: {}, query: '你好', response_mode: 'streaming', user: 'probe-' + Date.now() })
    });
    var out = { status: r.status, reader: !!(r.body && r.body.getReader), first: null, chunks: 0, samples: [] };
    if (!out.reader) return out;
    var rd = r.body.getReader(), dec = new TextDecoder('utf-8'), buf = '';
    while (true) {
      var res = await rd.read();
      if (res.done) break;
      buf += dec.decode(res.value, { stream: true });
      var parts = buf.split('\\n\\n'); buf = parts.pop();
      for (var i = 0; i < parts.length; i++) {
        var line = null, ls = parts[i].split('\\n');
        for (var k = 0; k < ls.length; k++) if (ls[k].indexOf('data:') === 0) { line = ls[k].slice(5).trim(); break; }
        if (!line || line === '[DONE]') continue;
        var ev; try { ev = JSON.parse(line); } catch (e) { continue; }
        if (ev.event !== 'message') continue;
        out.chunks++;
        if (out.first == null) out.first = Math.round(performance.now() - t0);
        var txt = String(ev.answer != null ? ev.answer : (ev.data && ev.data.answer) || '');
        if (out.samples.length < 5) out.samples.push(txt.slice(0, 30));
      }
    }
    out.total = Math.round(performance.now() - t0);
    return out;
  })()`);
  console.log('SSE 探测:', JSON.stringify(probe, null, 1));
} finally {
  await b.close();
}
