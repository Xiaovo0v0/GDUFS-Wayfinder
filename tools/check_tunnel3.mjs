// 从隧道中心正上方往下打射线，看第一层挡住的是什么
import { Browser } from './cdp.mjs';

const b = new Browser({ width: 1200, height: 800 });
await b.launch('http://127.0.0.1:8080/index.html?cb=' + Date.now());
try {
  await b.waitFor('window.__navDebug && !!window.__navDebug.mode', 30000).catch(() => {});
  const r = await b.eval(`(function(){
    var d = window.__navDebug, box = d.tunnelBox;
    var cx = (box[0]+box[2])/2, cz = (box[1]+box[3])/2;
    var rc = new THREE.Raycaster(new THREE.Vector3(cx, 200, cz), new THREE.Vector3(0,-1,0));
    var hits = rc.intersectObjects(d.scene.children, true).slice(0, 6).map(function(h){
      var m = h.object.material;
      return { y: +(200 - h.distance).toFixed(2), type: h.object.geometry.type,
               color: m && m.color ? '#' + m.color.getHexString() : '-',
               transparent: !!(m && m.transparent), opacity: m && m.opacity, name: h.object.name || '' };
    });
    return { center: [cx, cz], hits: hits };
  })()`);
  console.log(JSON.stringify(r, null, 1));
} finally {
  await b.close();
}
