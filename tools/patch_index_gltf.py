import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\index.html'
s = io.open(p, encoding='utf-8').read()
old = '<script src="vendor/OrbitControls.js"></script>'
new = '<script src="vendor/OrbitControls.js"></script>\n<script src="vendor/GLTFLoader.js"></script>'
assert old in s and 'GLTFLoader.js' not in s
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('index.html patched')
