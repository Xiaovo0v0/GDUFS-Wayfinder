import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9377, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html?v=' + Date.now());
  await b.send('Network.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: true });
  await b.send('Page.reload', { ignoreCache: true });
  await sleep(7000);

  // 飞到图书馆正上方斜视
  await b.eval(`(() => { const d = window.__navDebug; d.flyTo(83, 179, 120, 200); return 1; })()`, { awaitPromise: false });
  await sleep(1600);

  const pt = await b.eval(`(() => {
    const d = window.__navDebug;
    const v = new THREE.Vector3(83, 14, 179).project(d.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  })()`);
  console.log('screen point', JSON.stringify(pt));
  await b.click(pt.x, pt.y);
  await sleep(1200);

  const card = await b.eval(`({
    hidden: document.getElementById('bcard').classList.contains('hidden'),
    name: document.getElementById('bcard-name').textContent,
    meta: document.getElementById('bcard-meta').textContent,
    func: document.getElementById('bcard-func').textContent.slice(0, 80),
    foot: document.getElementById('bcard-foot').textContent.slice(0, 120),
    status: document.getElementById('status').innerText.slice(0, 60)
  })`);
  console.log(JSON.stringify(card, null, 2));
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/3d/info_card.png');
} finally {
  await b.close();
}
