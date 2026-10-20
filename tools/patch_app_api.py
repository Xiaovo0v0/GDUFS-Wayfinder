import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

anchor = '  setStatus("请选择起点和终点（可直接点击画面中的建筑）。");'
if anchor not in s:
    raise SystemExit('anchor not found')

addition = '''  // ============================================================
  // 12. 对外接口（供 AI 面板调用）
  // ============================================================
  function normPlace(s) {
    return (s || "").replace(/[（(].*?[）)]/g, "").replace(/[\\s·、,，]/g, "").toLowerCase();
  }

  function findPlace(label) {
    if (!label) { return null; }
    var n = normPlace(label);
    if (!n) { return null; }
    var exact = null, part = null;
    for (var i = 0; i < places.length; i++) {
      var pn = normPlace(places[i].label);
      if (pn === n) { exact = places[i]; break; }
      if (!part && (pn.indexOf(n) >= 0 || n.indexOf(pn) >= 0)) { part = places[i]; }
    }
    return exact || part;
  }

  window.__navDebug.findPlace = findPlace;
  window.__navDebug.placeLabels = places.map(function (p) { return p.label; });
  window.__navDebug.currentPlaces = function () {
    return { from: startPlace && startPlace.label, to: endPlace && endPlace.label };
  };
  window.__navDebug.setPlaces = function (fromLabel, toLabel) {
    var f = findPlace(fromLabel), t = findPlace(toLabel);
    if (f) { startPlace = f; }
    if (t) { endPlace = t; }
    syncSelects();
    if (startPlace && endPlace) { route(); }
    return { from: startPlace && startPlace.label, to: endPlace && endPlace.label, routed: !!(startPlace && endPlace) };
  };

  // 相机飞行：把镜头推到某个地面点
  var flyState = null;
  window.__navDebug.flyTo = function (x, z, height, dist) {
    var h = height || 60;
    var d = dist || 220;
    flyState = {
      t0: performance.now(),
      dur: 900,
      fromT: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      toT: { x: x, y: 0, z: z },
      fromC: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      toC: { x: x + d * 0.35, y: h, z: z + d },
    };
  };

  function tickFly() {
    if (!flyState) { return; }
    var k = Math.min(1, (performance.now() - flyState.t0) / flyState.dur);
    var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    controls.target.set(
      flyState.fromT.x + (flyState.toT.x - flyState.fromT.x) * e,
      flyState.fromT.y + (flyState.toT.y - flyState.fromT.y) * e,
      flyState.fromT.z + (flyState.toT.z - flyState.fromT.z) * e
    );
    camera.position.set(
      flyState.fromC.x + (flyState.toC.x - flyState.fromC.x) * e,
      flyState.fromC.y + (flyState.toC.y - flyState.fromC.y) * e,
      flyState.fromC.z + (flyState.toC.z - flyState.fromC.z) * e
    );
    controls.update();
    if (k >= 1) { flyState = null; }
  }

'''

s = s.replace(anchor, addition + anchor, 1)

# 在渲染循环里插入 tickFly
old_loop = """  function animate() {
    requestAnimationFrame(animate);
    controls.update();"""
new_loop = """  function animate() {
    requestAnimationFrame(animate);
    tickFly();
    controls.update();"""
if old_loop not in s:
    raise SystemExit('loop anchor not found')
s = s.replace(old_loop, new_loop, 1)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('patched app.js', len(s))
