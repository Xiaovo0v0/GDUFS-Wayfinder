import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()
orig = s

reps = [
    ("""  var buildingMeshes = [];
  var roofDetailGroup = new THREE.Group();
  scene.add(roofDetailGroup);""",
     """  var buildingMeshes = [];
  var procedural = new THREE.Group();   // 程序化几何（GLB 加载成功后会被替换）
  scene.add(procedural);
  var roofDetailGroup = new THREE.Group();
  procedural.add(roofDetailGroup);"""),
    ("    scene.add(walls);", "    procedural.add(walls);"),
    ("      scene.add(roof);", "      procedural.add(roof);"),
    ("    scene.add(par);", "    procedural.add(par);"),
]

for a, b in reps:
    if a not in s:
        print("MISS:", a[:60].replace("\n", "\\n"))
    s = s.replace(a, b)

anchor = """    disc.position.set(g.x, 0.8, g.z);
    scene.add(disc);
  });
"""
glb_block = anchor + """
  // ============================================================
  // 6.5 优先加载 Blender 导出的 LOD2 模型；失败则保留程序化几何
  // ============================================================
  (function loadDetailedModel() {
    if (!THREE.GLTFLoader) { return; }
    var loader = new THREE.GLTFLoader();
    loader.load("assets/gdufs_buildings.glb", function (gltf) {
      var byId = {};
      D.buildings.forEach(function (b) { byId[b.id] = b; });
      var tagged = 0;
      gltf.scene.traverse(function (o) {
        if (!o.isMesh) { return; }
        o.castShadow = true;
        o.receiveShadow = true;
        var id = (o.name || "").split("_")[0];
        var b = byId[id];
        if (b) { o.userData.building = b; tagged++; }
        if (o.material && o.material.map) { o.material.map.anisotropy = 4; }
      });
      scene.remove(procedural);
      scene.add(gltf.scene);
      buildingMeshes.length = 0;
      gltf.scene.traverse(function (o) { if (o.isMesh) { buildingMeshes.push(o); } });
      window.__navDebug.mode = "glb";
      window.__navDebug.glbObjects = gltf.scene.children.length;
      window.__navDebug.glbTagged = tagged;
      var sub = document.querySelector("#panel .sub");
      if (sub) { sub.innerHTML = sub.innerHTML.replace("程序化立面与屋顶", "Blender LOD2 模型"); }
    }, undefined, function () {
      window.__navDebug.mode = "procedural";
    });
  })();
"""

if anchor not in s:
    print("MISS anchor gates")
else:
    s = s.replace(anchor, glb_block, 1)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print("changed", s != orig, len(s))
