import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()
old = """        var id = (o.name || "").split("_")[0];
        var b = byId[id];
        if (b) { o.userData.building = b; tagged++; }"""
new = """        var tag = (o.name || "") + "|" + (o.parent ? o.parent.name : "");
        var mm = tag.match(/B\\d{3}[A-Z]?/);
        var b = mm ? byId[mm[0]] : null;
        if (b) { o.userData.building = b; tagged++; }"""
if old not in s:
    print("MISS")
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok', 'mm = tag.match' in s)
