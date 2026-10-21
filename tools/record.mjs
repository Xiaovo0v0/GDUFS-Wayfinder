// 录屏：用 CDP screencast 抓帧，跑一段脚本化场景，最后交给 ffmpeg 编码。
//   node tools/record.mjs --url "http://127.0.0.1:8080/?lang=zh" --out artifacts/video/a --seconds 60
// 产出：<out>/frames/00001.jpg ... 以及 <out>/timing.json（每帧的相对时间戳）
import fs from 'node:fs';
import path from 'node:path';
import { Browser } from './cdp.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const argOf = (k, d = null) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};

const URL = argOf('--url', 'http://127.0.0.1:8080/?lang=zh');
const OUT = argOf('--out', 'artifacts/video/seg');
const SEG = argOf('--seg', 'main');
const W = Number(argOf('--w', '1440'));
const H = Number(argOf('--h', '810'));

fs.rmSync(OUT, { recursive: true, force: true });
const FR = path.join(OUT, 'frames');
fs.mkdirSync(FR, { recursive: true });

const b = new Browser({ port: 9370, visible: false });
await b.launch(URL);
await sleep(1200);

const frames = [];
let n = 0;
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (b.events.length) {
      const ev = b.events.shift();
      if (ev.method !== 'Page.screencastFrame') continue;
      const { data, sessionId, metadata } = ev.params;
      n += 1;
      const file = path.join(FR, String(n).padStart(5, '0') + '.jpg');
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      frames.push({ file: path.basename(file), t: (metadata && metadata.timestamp) || Date.now() / 1000 });
      try { await b.send('Page.screencastFrameAck', { sessionId }, 5000); } catch { /* 忽略 */ }
    }
  } finally {
    draining = false;
  }
}

await b.send('Page.startScreencast', {
  format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 1,
});
const tick = setInterval(drain, 60);

const t0 = Date.now();
const at = async (ms) => {
  const wait = ms - (Date.now() - t0);
  if (wait > 0) await sleep(wait);
};

const js = (code) => b.eval(code, { awaitPromise: false }).catch((e) => console.log('  js err:', String(e).slice(0, 120)));

console.log('录制', SEG, '→', OUT);
if (SEG === 'main') {
  // 0–6s：全景缓慢环绕
  await js(`(function(){var c=window.__navDebug; if(c&&c.controls){c.controls.autoRotate=true; c.controls.autoRotateSpeed=0.8;}})()`);
  await at(6000);
  await js(`(function(){var c=window.__navDebug; if(c&&c.controls){c.controls.autoRotate=false;}})()`);

  // 6–10s：准备提问
  await at(8000);
  await js(`(function(){var i=document.querySelector('#ai-input'); i.value='从文采园怎么去图书馆'; i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#ai-send').click();})()`);

  // 等 Dify 返回并画线
  await at(20000);
  await js(`(function(){ var r=window.__lastRoute||[]; var n=window.__navDebug; if(n&&n.flyTo&&r.length){ var a=r[0], z=r[r.length-1]; n.flyTo((a[0]+z[0])/2, (a[1]+z[1])/2, 200, 520); } })()`);
  await at(25000);

  // 25–37s：第一人称漫游（伪影已修，可以放心展示）
  await js(`(function(){ if(window.__walk && !window.__walk.isOn()) window.__walk.start(); })()`);
  await at(37000);
  await js(`(function(){ if(window.__walk && window.__walk.isOn()) window.__walk.stop(); })()`);
  await at(39500);

  // 39–58s：办事提问 + 卡片 + 点导航
  await js(`(function(){var i=document.querySelector('#ai-input'); i.value='成绩单在哪办'; i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#ai-send').click();})()`);
  await at(50000);
  await js(`(function(){var b=document.querySelector('#ai-body .act'); if(b) b.click();})()`);
  await at(55000);
} else if (SEG === 'north') {
  // 北校区：缓慢环绕，展示 42 栋 LOD2
  await js(`(function(){var c=window.__navDebug; if(c&&c.controls){c.controls.autoRotate=true; c.controls.autoRotateSpeed=0.55;}})()`);
  await at(7000);
} else if (SEG === 'en') {
  await at(3000);
  await js(`(function(){var i=document.querySelector('#ai-input'); i.value='How do I get to the library from Wencaiyuan?'; i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#ai-send').click();})()`);
  await at(16000);
}

await sleep(600);
clearInterval(tick);
await drain();
try { await b.send('Page.stopScreencast', {}); } catch { /* 忽略 */ }
await b.close();

// 计算相对时间与帧间隔，写 timing.json
const base = frames.length ? frames[0].t : 0;
const out = frames.map((f, i) => ({
  file: f.file,
  t: +(f.t - base).toFixed(3),
  dur: 0,
}));
for (let i = 0; i < out.length; i++) {
  const next = i + 1 < out.length ? out[i + 1].t : out[i].t + 0.1;
  out[i].dur = +Math.max(0.03, Math.min(0.6, next - out[i].t)).toFixed(3);
}
fs.writeFileSync(path.join(OUT, 'timing.json'), JSON.stringify(out, null, 1), 'utf8');
console.log('帧数', out.length, '总时长', out.reduce((s, f) => s + f.dur, 0).toFixed(1) + 's');
