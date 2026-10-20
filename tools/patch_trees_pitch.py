import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

# 1) insidePitch：运动场地内不种树
anchor = """  (function vegetation() {"""
add = """  function insidePitch(x, z) {
    for (var i = 0; i < D.landscape.length; i++) {
      var l = D.landscape[i];
      if (!l.pitch || l.water) { continue; }
      for (var j = 0; j < l.rings.length; j++) {
        if (pointInRing(x, z, l.rings[j])) { return true; }
      }
    }
    return false;
  }

  (function vegetation() {"""
if anchor not in s:
    raise SystemExit('MISS vegetation anchor')
s = s.replace(anchor, add, 1)

a1 = """            if (insideAnyBuilding(px, pz, 1.5)) continue;
            if (insideWater(px, pz)) continue;"""
b1 = """            if (insideAnyBuilding(px, pz, 1.5)) continue;
            if (insideWater(px, pz)) continue;
            if (insidePitch(px, pz)) continue;"""
if a1 not in s:
    raise SystemExit('MISS tree1')
s = s.replace(a1, b1, 1)

a2 = """      if (insideAnyBuilding(x, z, 3)) continue;
      if (insideWater(x, z)) continue;"""
b2 = """      if (insideAnyBuilding(x, z, 3)) continue;
      if (insideWater(x, z)) continue;
      if (insidePitch(x, z)) continue;"""
if a2 not in s:
    raise SystemExit('MISS tree2')
s = s.replace(a2, b2, 1)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('pitch tree filter added', len(s))
