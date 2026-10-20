import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

# 1) helper
anchor = "  var TYPE_COLOR = {"
helper = """  // three r128 没有色彩管理：十六进制被当作线性值，需手动做 sRGB→Linear 转换
  function col(h) { return new THREE.Color(h).convertSRGBToLinear(); }

"""
assert anchor in s
s = s.replace(anchor, helper + anchor, 1)

reps = [
    # ground / campus / landscape / roads
    ("new THREE.MeshLambertMaterial({ color: 0x27362c })", "new THREE.MeshLambertMaterial({ color: col(0x27362c) })"),
    ("scene.add(flatPolygonMesh(D.boundary, 0x44593f, 0.0, 1.0));", "scene.add(flatPolygonMesh(D.boundary, col(0x44593f), 0.0, 1.0));"),
    ("scene.add(flatPolygonMesh(l.rings, 0x4f7a52, 0.25, 1.0));", "scene.add(flatPolygonMesh(l.rings, col(0x4f7a52), 0.25, 1.0));"),
    ("scene.add(flatPolygonMesh(l.rings, 0x4a86a8, 0.45, 0.92));", "scene.add(flatPolygonMesh(l.rings, col(0x4a86a8), 0.45, 0.92));"),
    ("new THREE.MeshLambertMaterial({ color: 0x6f6b62, side: THREE.DoubleSide })", "new THREE.MeshLambertMaterial({ color: col(0x6f6b62), side: THREE.DoubleSide })"),
    # trees
    ("var trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b5340 });", "var trunkMat = new THREE.MeshLambertMaterial({ color: col(0x6b5340) });"),
    ("var crownMat = new THREE.MeshLambertMaterial({ color: 0x3f6b3c });", "var crownMat = new THREE.MeshLambertMaterial({ color: col(0x3f6b3c) });"),
    ("color.setHSL(0.28 + rand() * 0.06, 0.30 + rand() * 0.18, 0.26 + rand() * 0.12);",
     "color.setHSL(0.28 + rand() * 0.06, 0.30 + rand() * 0.18, 0.26 + rand() * 0.12).convertSRGBToLinear();"),
    # buildings
    ("color: st.roof, roughness: 0.95, metalness: 0.02", "color: col(st.roof), roughness: 0.95, metalness: 0.02"),
    ("color: st.accent, roughness: 0.9", "color: col(st.accent), roughness: 0.9"),
    ("new THREE.MeshStandardMaterial({ color: 0xb0b4b6, roughness: 0.9 })", "new THREE.MeshStandardMaterial({ color: col(0xb0b4b6), roughness: 0.9 })"),
    # gates
    ("var mat = new THREE.MeshStandardMaterial({ color: 0x9c5540, roughness: 0.85 });", "var mat = new THREE.MeshStandardMaterial({ color: col(0x9c5540), roughness: 0.85 });"),
]

missing = []
for a, b in reps:
    if a not in s:
        missing.append(a[:70])
    s = s.replace(a, b)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('missing:', missing)
