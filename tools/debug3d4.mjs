import { Browser } from './cdp.mjs';

const url = 'file:///C:/Users/86134/Desktop/gdufs/gdufs-3d/index.html';
const b = new Browser({ port: 9335, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await b.launch(url);
  await sleep(5000);
  const info = await b.eval(`(() => {
    const d = window.__navDebug, c = d.camera, t = d.controls.target;
    t.set(-20, 0, 60); c.position.set(60, 50, 150); c.lookAt(t.x, 0, t.z); d.controls.update();
    c.updateMatrixWorld();
    const rc = new THREE.Raycaster();
    const out = [];
    const pts = [[0.5, 0.35], [0.55, 0.3], [0.62, 0.42], [0.45, 0.55], [0.7, 0.5]];
    for (const [nx, ny] of pts) {
      rc.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), c);
      const hits = rc.intersectObjects(d.scene.children, true);
      const h = hits.find(x => x.object.isMesh);
      out.push(h ? { nx, ny, geo: h.object.geometry.type, mat: h.object.material.type,
        color: h.object.material.color ? '#' + h.object.material.color.getHexString() : null,
        y: h.point.y.toFixed(1), dist: h.distance.toFixed(0) } : { nx, ny, none: true });
    }
    return out;
  })()`);
  console.log(JSON.stringify(info, null, 2));
} finally {
  await b.close();
}
