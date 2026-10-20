import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

old = """  D.landscape.forEach(function (l) {
    if (!l.pitch || l.water) return;
    scene.add(flatPolygonMesh(l.rings, col(PITCH_COLOR[l.sport] || 0x4f7a52), 0.25, 1.0));"""

new = """  D.landscape.forEach(function (l) {
    if (!l.pitch || l.water) return;
    // 田径场是带内环的环状面：外圈跑道 + 内场草地
    if (l.sport === "running" && l.rings.length > 1) {
      scene.add(flatPolygonMesh([l.rings[0]], col(0x9a5f45), 0.22, 1.0));
      scene.add(flatPolygonMesh([l.rings[1]], col(0x4f8a48), 0.26, 1.0));
      return;
    }
    scene.add(flatPolygonMesh(l.rings, col(PITCH_COLOR[l.sport] || 0x4f7a52), 0.25, 1.0));"""

if old not in s:
    raise SystemExit('MISS pitch loop')
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('track ring rendering added', len(s))
