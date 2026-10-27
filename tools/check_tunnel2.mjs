// 直接查场景里隧道网格的位置与可见性
import { Browser } from './cdp.mjs';

const b = new Browser({ width: 1200, height: 800 });
await b.launch('http://127.0.0.1:8080/index.html?cb=' + Date.now());
try {
  await b.waitFor('window.__navDebug && !!window.__navDebug.mode', 30000).catch(() => {});
  const r = await b.eval(`(function(){
    var d = window.__navDebug, out = [];
    d.scene.traverse(function(o){
      if (!o.isMesh) return;
      var m = o.material;
      if (!m || !m.color) return;
      var h = m.color.getHex();
      if (h !== 0x2fd0ff) return;
      var wp = new THREE.Vector3();
      o.getWorldPosition(wp);
      var bb = new THREE.Box3().setFromObject(o);
      out.push({ type: o.geometry.type, x: +wp.x.toFixed(1), y: +wp.y.toFixed(1), z: +wp.z.toFixed(1),
                 vis: o.visible, parentVis: o.parent && o.parent.visible,
                 size: [+(bb.max.x-bb.min.x).toFixed(1), +(bb.max.y-bb.min.y).toFixed(1), +(bb.max.z-bb.min.z).toFixed(1)],
                 frustum: new THREE.Frustum().setFromProjectionMatrix(
                   new THREE.Matrix4().multiplyMatrices(d.camera.projectionMatrix, d.camera.matrixWorldInverse)).intersectsObject(o) });
    });
    return { n: out.length, sample: out.slice(0, 6), cam: { x: +d.camera.position.x.toFixed(0), y: +d.camera.position.y.toFixed(0), z: +d.camera.position.z.toFixed(0) } };
  })()`);
  console.log(JSON.stringify(r, null, 1));
} finally {
  await b.close();
}
