import io, re

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

def rep(a, b):
    global s
    if a not in s:
        print('MISS:', a[:70])
    s = s.replace(a, b)

rep("renderer.toneMappingExposure = 1.05;", "renderer.toneMappingExposure = 0.95;")
rep("scene.add(new THREE.HemisphereLight(0xdfefff, 0x26332a, 0.42));", "scene.add(new THREE.HemisphereLight(0xdfefff, 0x26332a, 0.30));")
rep("scene.add(new THREE.AmbientLight(0xffffff, 0.10));", "scene.add(new THREE.AmbientLight(0xffffff, 0.06));")
rep("var sun = new THREE.DirectionalLight(0xfff1d8, 1.05);", "var sun = new THREE.DirectionalLight(0xfff1d8, 0.85);")

# walls slightly deeper, roofs much darker
pairs = [
    ('wall: "#d3cbba"', 'wall: "#c4bba8"'),
    ('wall: "#d9cbb0"', 'wall: "#cbbd9f"'),
    ('wall: "#8e5340"', 'wall: "#854b39"'),
    ('wall: "#b06f56"', 'wall: "#a4644c"'),
    ('wall: "#c2ccd3"', 'wall: "#b3bfc7"'),
    ('wall: "#c8b596"', 'wall: "#b9a684"'),
    ('wall: "#dde2e5"', 'wall: "#cfd6da"'),
    ('wall: "#c6c1b6"', 'wall: "#b6b1a5"'),
    ('wall: "#d2c7ae"', 'wall: "#c2b69b"'),
    ('wall: "#cbb89a"', 'wall: "#bca887"'),
]
for a, b in pairs:
    rep(a, b)

for a, b in [('roof: "#8f8a80"', 'roof: "#6f6b62"'),
             ('roof: "#7d786e"', 'roof: "#615c54"'),
             ('roof: "#8b867c"', 'roof: "#6b665d"'),
             ('roof: "#9aa4ab"', 'roof: "#7b848a"'),
             ('roof: "#9a9a96"', 'roof: "#7a7a76"')]:
    s = s.replace(a, b)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok', len(s))
