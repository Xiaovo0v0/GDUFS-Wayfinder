import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

anchor = """  // 河道 / 水渠（OSM，ODbL）"""
add = """  // 湖面（OSM relation，ODbL）
  if (D.waterPolygons) {
    D.waterPolygons.forEach(function (w) {
      scene.add(flatPolygonMesh(w.rings, col(0x2f6f8c), 0.5, 0.95));
      // 岸线
      w.rings.forEach(function (ring) {
        var pts = ring.map(function (p) { return new THREE.Vector3(p[0], 0.62, p[1]); });
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x86c6dd, transparent: true, opacity: 0.7 })
        ));
      });
    });
  }

  // 河道 / 水渠（OSM，ODbL）"""

if anchor not in s:
    raise SystemExit('MISS water anchor')
s = s.replace(anchor, add, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('lake rendering added', len(s))
