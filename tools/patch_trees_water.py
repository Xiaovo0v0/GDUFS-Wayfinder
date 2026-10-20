import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

# 1) 新增 insideWater 判断（放在 insideAnyBuilding 之后）
anchor = """  (function vegetation() {"""
add = """  function insideWater(x, z) {
    if (!D.waterPolygons) { return false; }
    for (var i = 0; i < D.waterPolygons.length; i++) {
      var rings = D.waterPolygons[i].rings;
      for (var j = 0; j < rings.length; j++) {
        if (pointInRing(x, z, rings[j])) { return true; }
      }
    }
    return false;
  }

  (function vegetation() {"""
if anchor not in s:
    raise SystemExit('MISS vegetation anchor')
s = s.replace(anchor, add, 1)

# 2) 行道树跳过水面
a1 = """            if (insideAnyBuilding(px, pz, 1.5)) continue;"""
b1 = """            if (insideAnyBuilding(px, pz, 1.5)) continue;
            if (insideWater(px, pz)) continue;"""
if a1 not in s:
    raise SystemExit('MISS tree1')
s = s.replace(a1, b1, 1)

# 3) 散树跳过水面
a2 = """      if (insideAnyBuilding(x, z, 3)) continue;"""
b2 = """      if (insideAnyBuilding(x, z, 3)) continue;
      if (insideWater(x, z)) continue;"""
if a2 not in s:
    raise SystemExit('MISS tree2')
s = s.replace(a2, b2, 1)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('vegetation water filter added', len(s))
