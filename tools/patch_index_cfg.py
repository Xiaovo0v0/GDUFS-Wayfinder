import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\index.html'
s = io.open(p, encoding='utf-8').read()
old = '<script src="app.js"></script>\n<script src="navigator-ui.js"></script>'
new = '<script src="app.js"></script>\n<script src="ai-config.js"></script>\n<script src="navigator-ui.js"></script>'
if old not in s:
    print('MISS anchor')
else:
    s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok', 'ai-config.js' in s)
