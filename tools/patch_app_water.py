import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

anchor = """  var roadGroup = new THREE.Group();"""
if anchor not in s:
    raise SystemExit('anchor not found')

add = """  // 河道 / 水渠（OSM，ODbL）
  if (D.water) {
    D.water.forEach(function (w) {
      w.lines.forEach(function (pts) {
        var g = ribbonGeometry(pts, w.kind === "canal" ? 7 : 11, 0.55);
        scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
          color: col(0x3f7f96), side: THREE.DoubleSide, transparent: true, opacity: 0.92
        })));
      });
    });
  }

  var roadGroup = new THREE.Group();"""

s = s.replace(anchor, add, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('water rendering added', len(s))
