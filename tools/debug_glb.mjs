import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9337, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('http://127.0.0.1:8765/gdufs-3d/index.html');
  await sleep(7000);
  const info = await b.eval(`(() => {
    const d = window.__navDebug;
    let meshes = 0, withMap = 0, names = [], mats = [];
    d.scene.traverse(o => {
      if (!o.isMesh) return;
      meshes++;
      const m = o.material;
      if (m && m.map) withMap++;
      if (names.length < 6) names.push({ name: o.name, parent: o.parent && o.parent.name, mat: m && m.type, map: !!(m && m.map) });
      if (mats.length < 4 && m) mats.push({ color: m.color ? '#' + m.color.getHexString() : null, map: !!(m.map), side: m.side, rough: m.roughness });
    });
    // 取一个带 UV 的 mesh 检查 uv 范围
    let uvSample = null;
    d.scene.traverse(o => {
      if (uvSample || !o.isMesh || !o.geometry.attributes.uv) return;
      const uv = o.geometry.attributes.uv;
      let mn = [9, 9], mx = [-9, -9];
      for (let i = 0; i < Math.min(uv.count, 300); i++) {
        mn[0] = Math.min(mn[0], uv.getX(i)); mn[1] = Math.min(mn[1], uv.getY(i));
        mx[0] = Math.max(mx[0], uv.getX(i)); mx[1] = Math.max(mx[1], uv.getY(i));
      }
      uvSample = { name: o.name, count: uv.count, min: mn, max: mx };
    });
    return { meshes, withMap, names, mats, uvSample };
  })()`);
  console.log(JSON.stringify(info, null, 2));
} finally {
  await b.close();
}
