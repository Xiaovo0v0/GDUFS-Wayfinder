// 实测「问一句 → 屏幕上出现第一个字」的时间，验证流式是否真的生效
//   node tools/test_stream.mjs "成绩单在哪里办？"
import { Browser } from './cdp.mjs';

const q = process.argv[2] || '成绩单在哪里办？';
const URL = 'http://127.0.0.1:8080/index.html?cb=' + Date.now();

const b = new Browser({ width: 1400, height: 900 });
await b.launch('about:blank');
try {
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.goto(URL, 2500);
  await b.waitFor('window.__navDebug && !!window.__navDebug.mode', 30000).catch(() => {});
  await b.eval(`(function(){
    var p = document.getElementById('ai');
    if (p && p.classList.contains('collapsed')) document.getElementById('ai-toggle').click();
    var base = document.querySelectorAll('#ai-body .msg.bot').length;
    var i = document.getElementById('ai-input');
    i.value = ${JSON.stringify(q)};
    document.getElementById('ai-send').click();
    window.__t0 = performance.now();
    window.__first = null;
    window.__tick = setInterval(function(){
      var msgs = document.querySelectorAll('#ai-body .msg.bot');
      var last = msgs.length > base ? msgs[msgs.length - 1] : null;
      if (!window.__first && last && last.textContent.trim().length > 1) window.__first = performance.now();
      if (window.__first && document.getElementById('ai-send').disabled === false) {
        window.__done = performance.now(); clearInterval(window.__tick);
      }
    }, 60);
  })()`);

  await b.waitFor('!!window.__first', 90000).catch(() => {});
  await b.shot('artifacts/ai/stream_mid_' + Date.now() + '.png').catch(() => {});
  await b.waitFor('!!window.__done', 90000).catch(() => {});
  const r = await b.eval(`(function(){
    var msgs = document.querySelectorAll('#ai-body .msg.bot');
    var last = msgs[msgs.length - 1];
    return {
      first: window.__first ? Math.round(window.__first - window.__t0) : null,
      done: window.__done ? Math.round(window.__done - window.__t0) : null,
      text: last ? last.textContent.trim().slice(0, 300) : '(无回答)',
      card: !!(last && last.querySelector('.card, .svc'))
    };
  })()`);
  console.log('问题:', q);
  console.log('首字:', r.first != null ? r.first + ' ms' : '未出现');
  console.log('完成:', r.done != null ? r.done + ' ms' : '未完成');
  console.log('卡片:', r.card ? '有' : '无');
  console.log('---\n' + r.text);
  await b.shot('artifacts/ai/stream_' + Date.now() + '.png').catch(() => {});
} finally {
  await b.close();
}
