import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9394, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html?v=' + Date.now());
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Page.reload', { ignoreCache: true });
  await sleep(7000);

  const cases = ['一饭', '二饭', '三食堂', '13栋', '宿舍3栋', '实验楼C', 'C区', '教C', '教学楼f', '校医院', '大礼堂', '主校门', '图书馆', '北苑5栋', '师苑'];
  const res = await b.eval(`(() => {
    const out = {};
    for (const c of ${JSON.stringify(cases)}) {
      const p = window.__navDebug.findPlace(c);
      out[c] = p ? p.label : null;
    }
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 2));
} finally {
  await b.close();
}
