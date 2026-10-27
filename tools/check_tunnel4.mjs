// 从隧道中心正上方往下打射线（逐个对象 try/catch，跳过会抛错的），看谁挡在上面
import { Browser } from './cdp.mjs';

const b = new Browser({ width: 1200, height: 800 });
await b.launch('http://127.0.0.1:8080/index.html?cb=' + Date.now());
try {
  await b.waitFor('window.__navDebug && !!window.__navDebug.mode', 30000).catch(() => {});
  const r = await b.eval(`(function(){
    var d = window.__navDebug, box = d.tunnelBox;
    var cx = (box[0]+box[2])/2, cz = (box[1]+box[3])/2;
    var hits = [];
    var ray = new THREE.Raycaster(new THREE.Vector3(cx, 300, cz), new THREE.Vector3(0,-1,0));
    d.scene.traverse(function(o){
      if (!o.isMesh) return;
      for (var s = 1; s <= 3; s++) {
        ray.ray.origin.set(cx + s * 6, 300, cz + (s % 2 ? 5 : -5));
        try {
          var h = ray.intersectObject(o, false);
          if (h && h.length) {
            var m = o.material;
            hits.push({ y: +(300 - h[0].distance).toFixed(2),
                        color: m && m.color ? '#' + m.color.getHexString() : '-',
                        geo: o.geometry.type, opacity: m && m.opacity, transparent: !!(m && m.transparent) });
          }
        } catch (e) {}
      }
    });
    hits.sort(function(a, b2){ return a.y - b2.y; });
    return { center: [cx, cz], top: hits.slice(0, 8), count: hits.length };
  })()`);
  console.log(JSON.stringify(r, null, 1));
} finally {
  await b.close();
}
