// 把相机放到隧道正上方俯视，取画面中心像素颜色，判断青带是否真的画出来了
import { Browser } from './cdp.mjs';

const b = new Browser({ width: 900, height: 600 });
await b.launch('http://127.0.0.1:8080/index.html?cb=' + Date.now());
try {
  await b.waitFor('window.__navDebug && !!window.__navDebug.mode', 30000).catch(() => {});
  await b.eval(`(function(){
    window.__walkActive = true;                 // 冻结 animate 里的相机接管
    var d = window.__navDebug, box = d.tunnelBox;
    var cx = (box[0]+box[2])/2, cz = (box[1]+box[3])/2;
    d.camera.position.set(cx, 90, cz + 0.01);
    d.camera.lookAt(cx, 0, cz);
    d.camera.updateMatrixWorld();
    d.controls.enabled = false;
  })()`);
  await new Promise(r => setTimeout(r, 800));
  const px = await b.eval(`(function(){
    var c = window.__navDebug.renderer.domElement;
    var g = document.createElement('canvas');
    g.width = c.width; g.height = c.height;
    g.getContext('2d').drawImage(c, 0, 0);
    var ctx = g.getContext('2d');
    var w = g.width, h = g.height;
    var out = {};
    [[w/2, h/2], [w*0.25, h*0.5], [w*0.75, h*0.5], [w/2, h*0.25]].forEach(function(p, i){
      var d2 = ctx.getImageData(p[0]|0, p[1]|0, 1, 1).data;
      out['p' + i] = [d2[0], d2[1], d2[2]];
    });
    return out;
  })()`);
  console.log('画布尺寸', await b.eval('[window.__navDebug.renderer.domElement.width, window.__navDebug.renderer.domElement.height]'));
  console.log('采样像素', JSON.stringify(px));
  await b.shot('artifacts/3d/tunnel_top.png');
  console.log('截图 artifacts/3d/tunnel_top.png');
} finally {
  await b.close();
}
