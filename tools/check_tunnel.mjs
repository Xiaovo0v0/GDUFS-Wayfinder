// 检查地下隧道在场景里是否还在（数据、tunnelBox、可见网格、标签）
import { Browser } from './cdp.mjs';

const b = new Browser({ width: 1400, height: 900 });
await b.launch('http://127.0.0.1:8080/index.html?cb=' + Date.now());
try {
  await b.waitFor('window.__navDebug && !!window.__navDebug.mode', 30000).catch(() => {});
  const r = await b.eval(`(function(){
    var d = window.__navDebug || {};
    var tun = (window.GDUFS_DATA.roads || []).filter(function(x){ return x.tunnel; });
    var cyan = 0, meshes = 0;
    (d.scene || { children: [] }).traverse(function(o){
      if (!o.isMesh && !o.isLine) return;
      meshes++;
      var m = o.material;
      if (m && m.color && Math.abs(m.color.getHex() - 0x2fd0ff) < 0x010101) cyan++;
    });
    return {
      tunnelRoads: tun.length,
      tunnelPts: tun[0] ? tun[0].lines[0].length : 0,
      tunnelBox: d.tunnelBox,
      cyanObjects: cyan,
      totalMeshes: meshes,
      labels: Array.prototype.slice.call(document.querySelectorAll('#labels > *'))
        .map(function(e){ return e.textContent; }).filter(function(t){ return t.indexOf('隧道') >= 0; })
    };
  })()`);
  console.log(JSON.stringify(r, null, 1));

  // 把相机对准隧道中心拍一张
  await b.eval(`(function(){
    var d = window.__navDebug, box = d.tunnelBox;
    var cx = (box[0] + box[2]) / 2, cz = (box[1] + box[3]) / 2;
    d.camera.position.set(cx + 60, 55, cz + 70);
    d.controls.target.set(cx, 0, cz);
    d.controls.update();
  })()`);
  await new Promise(r2 => setTimeout(r2, 1200));
  await b.shot('artifacts/3d/tunnel_check.png');
  console.log('截图 artifacts/3d/tunnel_check.png');
} finally {
  await b.close();
}
