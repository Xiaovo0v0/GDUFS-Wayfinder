import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

old = """  D.landscape.forEach(function (l) {
    if (!l.pitch || l.water) return;
    scene.add(flatPolygonMesh(l.rings, col(0x4f7a52), 0.25, 1.0));
  });"""

new = """  // 运动场地按 OSM sport 标签着色（篮球/网球/羽毛球/足球/排球）
  var PITCH_COLOR = {
    basketball: 0x3f6fa8, tennis: 0x4a8358, badminton: 0x4f7f72,
    soccer: 0x4f8a48, volleyball: 0xc0a068, running: 0x9a5f45, track: 0x9a5f45
  };
  D.landscape.forEach(function (l) {
    if (!l.pitch || l.water) return;
    scene.add(flatPolygonMesh(l.rings, col(PITCH_COLOR[l.sport] || 0x4f7a52), 0.25, 1.0));
    if (l.sport) {
      l.rings.forEach(function (ring) {
        var pts = ring.map(function (p) { return new THREE.Vector3(p[0], 0.36, p[1]); });
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0xf2f6f4, transparent: true, opacity: 0.55 })
        ));
      });
    }
  });"""

if old not in s:
    raise SystemExit('MISS pitch block')
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('pitch coloring added', len(s))
