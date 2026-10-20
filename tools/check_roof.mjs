import { Browser } from './cdp.mjs';
const b = new Browser({ port: 9335 });
await b.launch('file:///C:/Users/86134/Desktop/gdufs/gdufs-3d/index.html');
await new Promise(r=>setTimeout(r,5000));
const r = await b.eval(`(() => {
  const d=window.__navDebug; let out=null;
  d.scene.traverse(o=>{ if(out) return; if(o.isMesh && o.geometry.type==='ShapeGeometry' && o.material.type==='MeshStandardMaterial'){
    const n=o.geometry.attributes.normal; out={normal:[n.getX(0).toFixed(2),n.getY(0).toFixed(2),n.getZ(0).toFixed(2)], color:'#'+o.material.color.getHexString(), side:o.material.side};
  }});
  return out;
})()`);
console.log(JSON.stringify(r));
await b.close();

