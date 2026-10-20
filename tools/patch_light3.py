import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()
pairs = [
    ('0x26332a, 0.55', '0x26332a, 0.40'),
    ('AmbientLight(0xffffff, 0.18)', 'AmbientLight(0xffffff, 0.12)'),
    ('0xfff1d8, 1.55', '0xfff1d8, 1.00'),
    ('toneMappingExposure = 1.12', 'toneMappingExposure = 1.05'),
]
for a, b in pairs:
    if a not in s:
        print('MISS', a)
    s = s.replace(a, b)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
