import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()
old = 'loader.load("assets/gdufs_buildings.glb", function (gltf) {'
new = 'loader.load(window.GDUFS_GLB_URL || "assets/gdufs_buildings.glb", function (gltf) {'
if old not in s:
    raise SystemExit('MISS glb anchor')
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('app.js glb url configurable')
