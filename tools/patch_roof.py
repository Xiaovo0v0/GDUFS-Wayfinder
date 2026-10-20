import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()
pairs = [
    ('roof: "#6f6b62"', 'roof: "#6a6f73"'),
    ('roof: "#615c54"', 'roof: "#5d6165"'),
    ('roof: "#6b665d"', 'roof: "#63676b"'),
    ('roof: "#7b848a"', 'roof: "#767f85"'),
    ('roof: "#7a7a76"', 'roof: "#71757a"'),
]
for a, b in pairs:
    if a not in s:
        print("MISS", a)
    s = s.replace(a, b)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
