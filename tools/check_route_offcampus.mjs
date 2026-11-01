// 前端真机校验：算出来的路线到底有没有走出校区
//   node tools/check_route_offcampus.mjs [baseUrl] [outPng]
// 走的是页面里真实的 route()：setPlaces 选起终点，再读 window.__lastRoute / __lastRouteDist，
// 用 GDUFS_DATA.boundary 对折线逐 2 m 采样判内外，统计「校外长度」。
import { Browser } from './cdp.mjs';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:8080/';
const out = process.argv[3] || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 页面里执行：返回每个起终点的距离、折线长度、校外长度、是否经隧道、状态栏文字
const PROBE = `(() => {
  const inRing = (x, z, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], zi = ring[i][1], xj = ring[j][0], zj = ring[j][1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  const rings = (window.GDUFS_DATA && window.GDUFS_DATA.boundary) || [];
  const tb = (window.__navDebug && window.__navDebug.tunnelBox) || null;
  const inTunnelBox = (x, z) => !!tb && x >= tb[0] - 8 && x <= tb[2] + 8 && z >= tb[1] - 8 && z <= tb[3] + 8;
  const inside = (x, z) => rings.some((r) => inRing(x, z, r)) || inTunnelBox(x, z);
  const offLen = (pts) => {
    let off = 0;
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0], az = pts[i - 1][1], bx = pts[i][0], bz = pts[i][1];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(L / 2));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        if (!inside(ax + (bx - ax) * t, az + (bz - az) * t)) off += L / n;
      }
    }
    return off;
  };
  const status = document.getElementById('status');
  const one = (a, b) => {
    const ok = window.__navDebug.setPlaces(a, b);
    if (!ok) return { a: a, b: b, err: 'place not found' };
    const pts = window.__lastRoute || [];
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return {
      a: a, b: b,
      dist: window.__lastRouteDist,
      polyline: Math.round(len),
      offcampus: Math.round(offLen(pts)),
      tunnel: /隧道/.test(status.innerText || ''),
      status: (status.innerText || '').replace(/\\s+/g, ' ').slice(0, 90),
      pts: pts.length
    };
  };
  return [
    one('北苑1栋', '学生活动中心'),
    one('北苑1栋', '图书馆'),
    one('学生活动中心', '图书馆'),
    one('正门', '学生活动中心'),
    one('4号门', '北苑1栋'),
    one('北苑1栋', '文采园（第一饭堂）'),
    one('南苑13栋', '实验楼B区')
  ];
})()`;

const b = new Browser({ port: 9337 });
try {
  await b.launch('about:blank');
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1576, height: 908, deviceScaleFactor: 1, mobile: false });
  await b.send('Page.navigate', { url: base });
  await sleep(500);
  await b.send('Page.reload', { ignoreCache: true });
  const ready = await b.waitFor('window.__navDebug && window.__navDebug.setPlaces && window.GDUFS_DATA', 60000).then(() => true).catch(() => false);
  if (!ready) throw new Error('页面未就绪');
  await sleep(2500);

  const rows = await b.eval(PROBE);
  for (const r of rows) console.log(JSON.stringify(r));

  if (out) {
    // 回到第一条，截图留证
    await b.eval(`window.__navDebug.setPlaces('北苑1栋','学生活动中心')`, { awaitPromise: false });
    await sleep(1500);
    fs.mkdirSync('artifacts/3d', { recursive: true });
    const shot = await b.shotClean(out);
    console.log('shot ' + out + ' holes=' + shot.holes);
  }
} finally {
  await b.close();
}
