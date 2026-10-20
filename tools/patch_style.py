import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()
orig = s

reps = [
    ("  renderer.outputEncoding = THREE.sRGBEncoding;\n",
     "  renderer.outputEncoding = THREE.sRGBEncoding;\n  renderer.toneMapping = THREE.ACESFilmicToneMapping;\n  renderer.toneMappingExposure = 1.05;\n"),
    ("scene.add(new THREE.HemisphereLight(0xdfefff, 0x26332a, 0.55));\n  scene.add(new THREE.AmbientLight(0xffffff, 0.14));\n  var sun = new THREE.DirectionalLight(0xfff1d8, 0.8);",
     "scene.add(new THREE.HemisphereLight(0xdfefff, 0x26332a, 0.42));\n  scene.add(new THREE.AmbientLight(0xffffff, 0.10));\n  var sun = new THREE.DirectionalLight(0xfff1d8, 1.05);"),
    ('academic:  { kind: "ribbon",  wall: "#e7e0d1", accent: "#a9563f", glass: "#4c5f68", roof: "#c7c0b0" }',
     'academic:  { kind: "ribbon",  wall: "#d3cbba", accent: "#9c4f39", glass: "#3a4a52", roof: "#8f8a80" }'),
    ('dormitory: { kind: "punch",   wall: "#ece1cb", accent: "#d3c3a6", glass: "#54606a", roof: "#c9c2b2" }',
     'dormitory: { kind: "punch",   wall: "#d9cbb0", accent: "#b9a888", glass: "#414e57", roof: "#8f8a80" }'),
    ('library:   { kind: "curtain", wall: "#9a5a45", accent: "#7c4331", glass: "#3d6a68", roof: "#b7ae9e" }',
     'library:   { kind: "curtain", wall: "#8e5340", accent: "#6f3b2b", glass: "#2f5a58", roof: "#7d786e" }'),
    ('canteen:   { kind: "large",   wall: "#c9836a", accent: "#a9604a", glass: "#4f5d63", roof: "#bfb5a3" }',
     'canteen:   { kind: "large",   wall: "#b06f56", accent: "#8f4f3c", glass: "#3c4a50", roof: "#8b867c" }'),
    ('sports:    { kind: "panel",   wall: "#d7e0e6", accent: "#93a7b5", glass: "#7f97a8", roof: "#b6c0c8" }',
     'sports:    { kind: "panel",   wall: "#c2ccd3", accent: "#8799a6", glass: "#6b8496", roof: "#9aa4ab" }'),
    ('culture:   { kind: "ribbon",  wall: "#dcc9ad", accent: "#a9563f", glass: "#4e5d66", roof: "#c3b8a4" }',
     'culture:   { kind: "ribbon",  wall: "#c8b596", accent: "#9c4f39", glass: "#3a4a52", roof: "#8f8a80" }'),
    ('clinic:    { kind: "punch",   wall: "#eef0f1", accent: "#cfd6da", glass: "#5a666e", roof: "#c9c9c9" }',
     'clinic:    { kind: "punch",   wall: "#dde2e5", accent: "#b9c2c7", glass: "#47545c", roof: "#9a9a96" }'),
    ('other:     { kind: "punch",   wall: "#d9d5cc", accent: "#b9b3a6", glass: "#59636a", roof: "#c4c0b6" }',
     'other:     { kind: "punch",   wall: "#c6c1b6", accent: "#a49e90", glass: "#454f56", roof: "#8f8a80" }'),
    ('B002: { kind: "curtain", wall: "#9a5a45", accent: "#7c4331", glass: "#3d6a68", roof: "#b7ae9e" }',
     'B002: { kind: "curtain", wall: "#8e5340", accent: "#6f3b2b", glass: "#2f5a58", roof: "#7d786e" }'),
    ('B001: { kind: "ribbon", wall: "#e5dcc8", accent: "#9d5340" }',
     'B001: { kind: "ribbon", wall: "#d2c7ae", accent: "#8f4a36" }'),
    ('B031: { kind: "panel", wall: "#dbe3e8", accent: "#8fa3b2", roof: "#b6c0c8" }',
     'B031: { kind: "panel", wall: "#c6d0d7", accent: "#8496a3", roof: "#9aa4ab" }'),
    ('B032: { kind: "ribbon", wall: "#ddcdb4", accent: "#a45a44" }',
     'B032: { kind: "ribbon", wall: "#cbb89a", accent: "#94503c" }'),
]

missing = []
for a, b in reps:
    if a not in s:
        missing.append(a[:60])
    s = s.replace(a, b)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('changed:', s != orig, 'len:', len(s))
print('missing:', missing)
