/**
 * 广外南校区 3D 导航
 * 数据：gdufs-data.js（由 build_nav_data.py 从 GeoJSON 投影生成，含道路拓扑图）
 * 场景：真实建筑轮廓挤出；道路/水系/运动场配景；沿道路网络寻路。
 */
(function () {
  "use strict";

  var CAMPUS = (function () {
    var m = /[?&]campus=(north|south)/.exec(location.search);
    return m ? m[1] : "south";
  })();
  var D = (CAMPUS === "north" && window.GDUFS_NORTH) ? window.GDUFS_NORTH : window.GDUFS_DATA;

  if (CAMPUS === "north") {
    document.title = "尚行 · 广外校园向导（白云山校区）";
    var _en = window.GDUFS_LANG && window.GDUFS_LANG.get() === "en";
    var _h1 = document.querySelector("#panel h1");
    var _sub = document.querySelector("#panel .sub");
    if (_h1) { _h1.textContent = _en ? "Baiyunshan Campus" : "北校区 · 广外校园向导"; }
    if (_sub && window.t) {
      _sub.setAttribute("data-i18n", "panel.sub.north");
      _sub.innerHTML = window.t("panel.sub.north");
    }
    var _hint = document.querySelector("#panel .hint");
    if (_hint && window.t) {
      _hint.setAttribute("data-i18n", "hint.body.north");
      _hint.innerHTML = window.t("hint.body.north");
    }
  }
  if (!D) {
    document.body.innerHTML = "<p style='font:16px sans-serif;padding:40px'>缺少 gdufs-data.js，请先运行 build_nav_data.py。</p>";
    return;
  }

  // three r128 没有色彩管理：十六进制被当作线性值，需手动做 sRGB→Linear 转换
  function col(h) { return new THREE.Color(h).convertSRGBToLinear(); }

  var TYPE_COLOR = {
    academic: 0xcdbb97, dormitory: 0xe3b08b, library: 0xb29266,
    canteen: 0xd18a62, sports: 0x8aaecb, culture: 0xc3a383,
    clinic: 0xdcdcdc, other: 0xc4c4c4
  };

  // ============================================================
  // 1. 空间范围
  // ============================================================
  var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  function grow(p) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1];
    if (p[1] > maxZ) maxZ = p[1];
  }
  D.boundary.forEach(function (ring) { ring.forEach(grow); });
  D.buildings.forEach(function (b) {
    b.rings.forEach(function (ring) { ring.forEach(grow); });
  });
  D.gates.forEach(function (g) { grow([g.x, g.z]); });

  var spanX = maxX - minX, spanZ = maxZ - minZ;
  var centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2;

  // ============================================================
  // 2. 场景 / 相机 / 渲染器
  // ============================================================
  var scene = new THREE.Scene();

  // ---- 天空与大气（B1）----
  // 北半球 15:00 的晴天：天顶偏蓝、地平线发白，配合轻雾让远景自然淡出
  var FOG_COLOR = col(0xcfe3f2);
  var sceneSpan = Math.max(spanX, spanZ);
  scene.background = FOG_COLOR.clone();
  scene.fog = new THREE.Fog(FOG_COLOR.clone(), sceneSpan * 1.15, sceneSpan * 4.5);

  function makeSkyDome(radius) {
    var geo = new THREE.SphereGeometry(radius, 32, 16);
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: col(0x2f6ea8) },
        bottomColor: { value: col(0xdfeaf4) },
        offset: { value: 0.12 },
        exponent: { value: 0.85 }
      },
      vertexShader: [
        "varying vec3 vWorldPosition;",
        "void main() {",
        "  vec4 worldPosition = modelMatrix * vec4(position, 1.0);",
        "  vWorldPosition = worldPosition.xyz;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 topColor;",
        "uniform vec3 bottomColor;",
        "uniform float offset;",
        "uniform float exponent;",
        "varying vec3 vWorldPosition;",
        "void main() {",
        "  float h = normalize(vWorldPosition + offset).y;",
        "  float k = max(pow(max(h, 0.0), exponent), 0.0);",
        "  gl_FragColor = vec4(mix(bottomColor, topColor, k), 1.0);",
        "}"
      ].join("\n"),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }

  scene.add(makeSkyDome(sceneSpan * 3.2));

  var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 4, 14000);

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  document.getElementById("app").appendChild(renderer.domElement);

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  function resetView() {
    var dist = Math.max(spanZ, spanX) * 0.82;
    controls.target.set(centerX, 0, centerZ - spanZ * 0.10);
    camera.position.set(centerX + dist * 0.07, dist * 0.32, centerZ - dist * 0.86);
    camera.lookAt(centerX, 0, centerZ - spanZ * 0.10);
    controls.update();
  }
  resetView();

  // ============================================================
  // 3. 光照
  // ============================================================
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x26332a, 0.34));
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));
  var sun = new THREE.DirectionalLight(0xfff1d8, 1.05);
  // 东南向 45°：坐标里 x=西为正、z=北为正，所以东南是 -x / -z
  var sunDist = Math.max(spanX, spanZ) * 1.15;
  sun.position.set(centerX - sunDist * 0.55, sunDist * 0.88, centerZ - sunDist * 0.55);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  var sc = sun.shadow.camera;
  var half = Math.max(spanX, spanZ) * 0.78;
  sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
  // 场景静态：阴影只烘一次，避免每帧重绘 4096 阴影贴图
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  sc.near = 10; sc.far = Math.max(spanX, spanZ) * 3;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  // ============================================================
  // 4. 几何工具
  // ============================================================
  function ringToShape(ring) {
    var pts = [];
    for (var i = 0; i < ring.length; i++) {
      var p = ring[i];
      if (i === ring.length - 1 && ring.length > 1 &&
          p[0] === ring[0][0] && p[1] === ring[0][1]) continue;
      pts.push([p[0], -p[1]]);
    }
    if (pts.length < 3) return null;

    var area = 0;
    for (var j = 0; j < pts.length; j++) {
      var a = pts[j], b = pts[(j + 1) % pts.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    if (area < 0) pts.reverse();

    var s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (var k = 1; k < pts.length; k++) s.lineTo(pts[k][0], pts[k][1]);
    s.closePath();
    return s;
  }

  function flatPolygonMesh(rings, color, y, opacity) {
    var group = new THREE.Group();
    rings.forEach(function (ring) {
      var shape = ringToShape(ring);
      if (!shape) return;
      var geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, y, 0);
      var mat = new THREE.MeshBasicMaterial({
        color: color, transparent: opacity < 1, opacity: opacity,
        side: THREE.DoubleSide, depthWrite: opacity >= 1
      });
      group.add(new THREE.Mesh(geo, mat));
    });
    return group;
  }

  function ribbonGeometry(pts, width, y, tileLen) {
    var pos = [];
    var uv = [];
    var run = 0;
    var tl = tileLen || 12;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var L = Math.hypot(dx, dz);
      if (L < 1e-6) continue;
      var nx = -dz / L * width / 2, nz = dx / L * width / 2;
      var a1 = [a[0] + nx, a[1] + nz], a2 = [a[0] - nx, a[1] - nz];
      var b1 = [b[0] + nx, b[1] + nz], b2 = [b[0] - nx, b[1] - nz];
      var v0 = run / tl, v1 = (run + L) / tl;
      pos.push(a1[0], y, a1[1], a2[0], y, a2[1], b1[0], y, b1[1]);
      uv.push(0, v0, 1, v0, 0, v1);
      pos.push(a2[0], y, a2[1], b2[0], y, b2[1], b1[0], y, b1[1]);
      uv.push(1, v0, 1, v1, 0, v1);
      run += L;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }

  // ============================================================
  // 5. 地面 / 校园范围 / 配景
  // ============================================================

  // ---- 程序化草地贴图（B2）：不引外部图片，单文件体积不受影响 ----
  function makeGrassTexture() {
    var c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    var g = c.getContext("2d");
    g.fillStyle = "#7d8b6a";
    g.fillRect(0, 0, 256, 256);

    var rnd = rng(20261021);
    // 细碎草点
    for (var i = 0; i < 3200; i++) {
      var x = rnd() * 256, y = rnd() * 256;
      var r = 0.5 + rnd() * 1.8;
      var v = 78 + rnd() * 62;
      g.fillStyle = "rgba(" + Math.round(v - 14) + "," + Math.round(v + 6) + "," + Math.round(v - 22) + ",0.30)";
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
    // 大块明暗起伏，避免出现规则噪点
    for (var j = 0; j < 70; j++) {
      var x2 = rnd() * 256, y2 = rnd() * 256, rr = 5 + rnd() * 20;
      g.fillStyle = rnd() > 0.5 ? "rgba(58,74,50,0.16)" : "rgba(150,164,132,0.10)";
      g.beginPath(); g.arc(x2, y2, rr, 0, 6.2832); g.fill();
    }
    // 少量土色斑，让地面不显得像塑料
    for (var k = 0; k < 14; k++) {
      var x3 = rnd() * 256, y3 = rnd() * 256, r3 = 3 + rnd() * 9;
      g.fillStyle = "rgba(122,110,84,0.10)";
      g.beginPath(); g.arc(x3, y3, r3, 0, 6.2832); g.fill();
    }

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  /* 楼前硬质铺装贴图：浅灰方砖 + 深缝，替代原来的单色灰绿台面。
   * 一贴图 = 2.4 m，配合 apron 的 UV（单位是米）平铺。
   */
  function makePaverTexture() {
    var c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    var g = c.getContext("2d");
    g.fillStyle = "#93918a";
    g.fillRect(0, 0, 256, 256);

    var rnd = rng(77123);
    // 每块砖轻微色差
    var tile = 64;
    for (var ty = 0; ty < 4; ty++) {
      for (var tx = 0; tx < 4; tx++) {
        var v = 142 + rnd() * 20;
        g.fillStyle = "rgba(" + Math.round(v) + "," + Math.round(v - 2) + "," + Math.round(v - 12) + ",0.55)";
        g.fillRect(tx * tile, ty * tile, tile, tile);
      }
    }
    // 砖缝
    g.strokeStyle = "rgba(96,94,88,0.55)";
    g.lineWidth = 2;
    for (var k = 0; k <= 4; k++) {
      g.beginPath(); g.moveTo(k * tile, 0); g.lineTo(k * tile, 256); g.stroke();
      g.beginPath(); g.moveTo(0, k * tile); g.lineTo(256, k * tile); g.stroke();
    }
    // 污渍，避免太干净
    for (var i = 0; i < 90; i++) {
      var x = rnd() * 256, y = rnd() * 256, r = 2 + rnd() * 9;
      g.fillStyle = "rgba(112,110,102,0.10)";
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    tex.repeat.set(1 / 2.4, 1 / 2.4);
    return tex;
  }

  // 带贴图的多边形面：ShapeGeometry 的 UV 等于形状坐标，所以按米设置平铺密度
  function texturedPolygonMesh(rings, tex, y, metersPerTile, tint) {
    var group = new THREE.Group();
    rings.forEach(function (ring) {
      var shape = ringToShape(ring);
      if (!shape) return;
      var geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, y, 0);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1 / metersPerTile, 1 / metersPerTile);
      var mat = new THREE.MeshLambertMaterial({
        map: tex, color: col(tint || 0xffffff), side: THREE.DoubleSide
      });
      group.add(new THREE.Mesh(geo, mat));
    });
    return group;
  }

  // 圆角矩形（用于楼前铺装），形状坐标系里 y = -z
  function roundedRectShape(cx, cz, halfW, halfD, r) {
    var s = new THREE.Shape();
    var x = cx, y = -cz, w = halfW, h = halfD;
    r = Math.max(0.5, Math.min(r, w * 0.9, h * 0.9));
    s.moveTo(x - w + r, y - h);
    s.lineTo(x + w - r, y - h);
    s.quadraticCurveTo(x + w, y - h, x + w, y - h + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x - w + r, y + h);
    s.quadraticCurveTo(x - w, y + h, x - w, y + h - r);
    s.lineTo(x - w, y - h + r);
    s.quadraticCurveTo(x - w, y - h, x - w + r, y - h);
    return s;
  }

  var groundSize = Math.max(spanX, spanZ) * 4.5;
  var groundTex = makeGrassTexture();
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(groundSize / 90, groundSize / 90);
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshLambertMaterial({ map: groundTex, color: col(0xb3bda6) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centerX, -0.6, centerZ);
  ground.receiveShadow = true;
  scene.add(ground);

  // 校园范围内：叠一层半透明深绿，让边界可辨，同时保留草地纹理
  scene.add(flatPolygonMesh(D.boundary, col(0x4e6642), 0.02, 0.28));

  D.boundary.forEach(function (ring) {
    var pts = ring.map(function (p) { return new THREE.Vector3(p[0], 0.9, p[1]); });
    var bl = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xbcd0ae, transparent: true, opacity: 0.55 })
    );
    bl.name = "boundaryLine";   // 漫游时隐藏，避免一条白线横在眼前
    scene.add(bl);
  });

  // 楼前铺装：每栋楼按包围盒外扩 3.5 m，浅灰圆角台，让建筑稳稳落在地上
  (function buildingAprons() {
    var group = new THREE.Group();
    var apronMat = new THREE.MeshLambertMaterial({
      map: makePaverTexture(), side: THREE.DoubleSide
    });
    D.buildings.forEach(function (b) {
      if (b.sub) return;   // 子建筑的铺装由母楼那一片覆盖
      var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      (b.rings || []).forEach(function (ring) {
        ring.forEach(function (p) {
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minZ) minZ = p[1];
          if (p[1] > maxZ) maxZ = p[1];
        });
      });
      if (!isFinite(minX)) return;
      var pad = 3.5;
      var cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      var hw = (maxX - minX) / 2 + pad, hd = (maxZ - minZ) / 2 + pad;
      var geo = new THREE.ShapeGeometry(roundedRectShape(cx, cz, hw, hd, 6));
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0.07, 0);
      group.add(new THREE.Mesh(geo, apronMat));
    });
    group.receiveShadow = true;
    scene.add(group);
  })();


  // 屋顶绿化（B5）：大屋顶铺一块绿，让俯视有层次，不做细节建模
  function addRoofGreenery() {
    var g = new THREE.Group();
    var mat = new THREE.MeshLambertMaterial({ color: col(0x4a6639), side: THREE.DoubleSide });
    D.buildings.forEach(function (b) {
      if (b.id === "B002" || b.id === "B031" || b.id === "B041" || b.id.indexOf("B045") === 0) return;
      if (["B033", "B034", "B036", "B037", "B038E", "B038F", "B038G"].indexOf(b.id) >= 0) return;
      if (b.type === "sports" || b.type === "dorm" || b.type === "gate") return;
      if ((b.area || 0) < 4500) return;
      var ring = b.rings && b.rings[0];
      if (!ring || ring.length < 3) return;
      var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      ring.forEach(function (p) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minZ) minZ = p[1];
        if (p[1] > maxZ) maxZ = p[1];
      });
      var bw = maxX - minX, bd = maxZ - minZ;
      var aspect = Math.max(bw, bd) / Math.max(1, Math.min(bw, bd));
      if (aspect > 3.2) return;              // 细长条形楼不做，避免像"绿条"
      var w = bw * 0.26, d = bd * 0.26;
      if (w < 5 || d < 5) return;
      var geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      geo.translate((minX + maxX) / 2, (b.height || 0) + 0.14, (minZ + maxZ) / 2);
      g.add(new THREE.Mesh(geo, mat));
    });
    scene.add(g);
    return g;
  }

  /* 屋顶设备：楼梯间出屋面 + 空调机组 + 屋面小构筑。
   * 近景时 BLENDER LOD2 屋顶是一整块板，空得不像真楼；
   * 这里按面积给每栋楼撒 1~3 个体块，合并成一个 InstancedMesh（一次 draw call）。
   */
  function addRoofClutter() {
    var rand = rng(20261027);   // rand 是植被 IIFE 里的局部变量，这里必须自己起一个
    var items = [];
    D.buildings.forEach(function (b) {
      if (b.sub) return;
      if (b.type === "sports" || b.type === "gate") return;
      var ring = b.rings && b.rings[0];
      if (!ring || ring.length < 3) return;
      var H = b.height || 0;
      if (H < 8) return;
      var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      var sx = 0, sz = 0;
      ring.forEach(function (p) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minZ) minZ = p[1];
        if (p[1] > maxZ) maxZ = p[1];
        sx += p[0]; sz += p[1];
      });
      var cx = sx / ring.length, cz = sz / ring.length;
      var hw = (maxX - minX) / 2, hd = (maxZ - minZ) / 2;
      if (hw < 3 || hd < 3) return;
      var area = b.area || 0;
      var want = area > 6000 ? 4 : (area > 3500 ? 3 : (area > 1200 ? 2 : 1));
      /* 在包围盒里随机撒点，用 pointInRing 命中率筛；
       * 不能从质心往外抖——L 形、U 形楼的质心常常落在天井外面，
       * 抖出来的点全被判出界，结果大屋顶一个设备都没有。
       */
      var placed = 0, tries = 0;
      while (placed < want && tries < 60) {
        tries++;
        var px = minX + rand() * (maxX - minX);
        var pz = minZ + rand() * (maxZ - minZ);
        if (!pointInRing(px, pz, ring)) continue;
        // 离轮廓至少 2.2 m，免得设备压在女儿墙上
        if (!pointInRing(px + 2.2, pz, ring) || !pointInRing(px - 2.2, pz, ring) ||
            !pointInRing(px, pz + 2.2, ring) || !pointInRing(px, pz - 2.2, ring)) continue;
        var stair = (placed === 0);
        var w = stair ? 3.0 + rand() * 2.4 : 1.1 + rand() * 1.3;
        var d = stair ? 2.6 + rand() * 1.8 : 1.1 + rand() * 1.1;
        var hh = stair ? 2.3 + rand() * 0.9 : 0.8 + rand() * 0.8;
        items.push({ x: px, z: pz, y: H - 0.12, w: w, d: d, h: hh, r: rand() * Math.PI, tone: stair ? 0 : 1 });
        placed++;
      }
    });
    if (!items.length) {
      if (window.__navDebug) window.__navDebug.roofClutter = 0;
      return;
    }
    var geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    var mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), items.length);
    var m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
    var s = new THREE.Vector3(), e = new THREE.Euler(), c = new THREE.Color();
    items.forEach(function (it, i) {
      e.set(0, it.r, 0);
      q.setFromEuler(e);
      v.set(it.x, it.y, it.z);
      s.set(it.w, it.h, it.d);
      m.compose(v, q, s);
      mesh.setMatrixAt(i, m);
      c.set(it.tone ? 0x9aa0a3 : 0xbdbab1).convertSRGBToLinear();
      mesh.setColorAt(i, c);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (window.__navDebug) window.__navDebug.roofClutter = items.length;
  }

  // ---- 北校区：道路与相思河来自官方平面图栅格化的透明图层 ----
  if (D.layers) {
    var addRasterLayer = function (cfg, y, order) {
      var ext = cfg.extent;
      var w = Math.abs(ext.x[0] - ext.x[1]);
      var h = Math.abs(ext.z[0] - ext.z[1]);
      var cxL = (ext.x[0] + ext.x[1]) / 2;
      var czL = (ext.z[0] + ext.z[1]) / 2;
      var tex = new THREE.TextureLoader().load(cfg.file);
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = 8;
      tex.center.set(0.5, 0.5);
      tex.rotation = Math.PI;      // 图像的列/行方向与局部坐标相反，旋转 180° 对齐
      var geo = new THREE.PlaneGeometry(w, h);
      geo.rotateX(-Math.PI / 2);
      var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide
      }));
      mesh.position.set(cxL, y, czL);
      mesh.renderOrder = order;
      scene.add(mesh);
      return mesh;
    };
    if (D.layers.river) { addRasterLayer(D.layers.river, 0.08, 2); }
    if (D.layers.roads) { addRasterLayer(D.layers.roads, 0.12, 3); }
  }

  // 运动场地按 OSM sport 标签着色（篮球/网球/羽毛球/足球/排球）
  var PITCH_COLOR = {
    basketball: 0x3f6fa8, tennis: 0x4a8358, badminton: 0x4f7f72,
    soccer: 0x4f8a48, volleyball: 0xc0a068, running: 0x9a5f45, track: 0x9a5f45
  };

  // ---- 塑胶跑道：红色胶面 + 白色分道线 + 足球场标线 ----
  function makeCanvasTex(w, h, draw) {
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    var g = cv.getContext("2d");
    draw(g, w, h);
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }
  var trackTex = makeCanvasTex(256, 256, function (g, w, h) {
    g.fillStyle = "#b5523f"; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 3200; i++) {
      g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.055)" : "rgba(255,255,255,0.045)";
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  trackTex.repeat.set(0.08, 0.08);
  var grassTex = makeCanvasTex(256, 256, function (g, w, h) {
    g.fillStyle = "#4f8a48"; g.fillRect(0, 0, w, h);
    for (var y = 0; y < h; y += 32) {
      g.fillStyle = (y / 32) % 2 ? "rgba(0,0,0,0.055)" : "rgba(255,255,255,0.03)";
      g.fillRect(0, y, w, 32);
    }
    for (var i = 0; i < 2600; i++) {
      g.fillStyle = "rgba(255,255,255,0.035)";
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  grassTex.repeat.set(0.05, 0.05);
  var whiteLineMat = new THREE.MeshBasicMaterial({
    color: 0xf2f6f4, side: THREE.DoubleSide, transparent: true, opacity: 0.96, depthWrite: false
  });

  function applyCanvasTex(grp, tex) {
    grp.traverse(function (o) {
      if (!o.isMesh) return;
      o.material.map = tex;
      o.material.color.set(0xffffff);
      o.material.needsUpdate = true;
    });
  }

  // 从中心沿角度打到环边，返回距离
  function rayRing(ring, cx, cz, ang, mode) {
    var dx = Math.cos(ang), dz = Math.sin(ang);
    var best = null;
    for (var i = 0; i < ring.length; i++) {
      var a = ring[i], b = ring[(i + 1) % ring.length];
      var ex = b[0] - a[0], ez = b[1] - a[1];
      var den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) continue;
      var t = ((a[0] - cx) * ez - (a[1] - cz) * ex) / den;
      var u = ((a[0] - cx) * dz - (a[1] - cz) * dx) / den;
      if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) {
        if (best === null || (mode === "max" ? t > best : t < best)) best = t;
      }
    }
    return best;
  }

  function addLaneNumber(n, x, z) {
    var cv = document.createElement("canvas");
    cv.width = 64; cv.height = 64;
    var g = cv.getContext("2d");
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = "#f2f6f4";
    g.font = "bold 40px Arial, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(n), 32, 34);
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.position.set(x, 0.7, z);
    sp.scale.set(3.0, 3.0, 1);
    scene.add(sp);
  }

  function addTrackMarkings(outer, inner) {
    var cx = 0, cz = 0;
    outer.forEach(function (p) { cx += p[0]; cz += p[1]; });
    cx /= outer.length; cz /= outer.length;
    var N = 180, LANES = 8;
    for (var k = 0; k <= LANES; k++) {
      var pts = [];
      for (var i = 0; i <= N; i++) {
        var ang = i / N * Math.PI * 2;
        var ro = rayRing(outer, cx, cz, ang, "max");
        var ri = rayRing(inner, cx, cz, ang, "min");
        if (ro === null) ro = ri;
        if (ri === null) ri = ro;
        if (ro === null) continue;
        var ox = cx + ro * Math.cos(ang), oz = cz + ro * Math.sin(ang);
        var ix = cx + ri * Math.cos(ang), iz = cz + ri * Math.sin(ang);
        var t = k / LANES;
        pts.push([ox + (ix - ox) * t, oz + (iz - oz) * t]);
      }
      if (pts.length > 1) scene.add(new THREE.Mesh(ribbonGeometry(pts, 0.22, 0.318, 1), whiteLineMat));
    }
    // 起终点线 + 道次号（放在东侧直道）
    var ang0 = 0;
    var ro0 = rayRing(outer, cx, cz, ang0, "max");
    var ri0 = rayRing(inner, cx, cz, ang0, "min");
    if (ro0 !== null && ri0 !== null) {
      var os = [cx + ro0 * Math.cos(ang0), cz + ro0 * Math.sin(ang0)];
      var is = [cx + ri0 * Math.cos(ang0), cz + ri0 * Math.sin(ang0)];
      scene.add(new THREE.Mesh(ribbonGeometry([os, is], 0.85, 0.322, 1), whiteLineMat));
      for (var k2 = 0; k2 < LANES; k2++) {
        var tt = (k2 + 0.5) / LANES;
        addLaneNumber(k2 + 1, os[0] + (is[0] - os[0]) * tt, os[1] + (is[1] - os[1]) * tt);
      }
    }
  }

  function addPitch(inner) {
    var xs = inner.map(function (p) { return p[0]; });
    var zs = inner.map(function (p) { return p[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minZ = Math.min.apply(null, zs), maxZ = Math.max.apply(null, zs);
    var cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    var iw = maxX - minX, ih = maxZ - minZ;
    var pw = Math.min(iw * 0.72, 68);
    var pl = Math.min(ih * 0.78, 105);
    var x1 = cx - pw / 2, x2 = cx + pw / 2;
    var z1 = cz - pl / 2, z2 = cz + pl / 2;
    var y = 0.322;
    function seg(ax, az, bx, bz, wid) {
      scene.add(new THREE.Mesh(ribbonGeometry([[ax, az], [bx, bz]], wid || 0.12, y, 1), whiteLineMat));
    }
    seg(x1, z1, x2, z1); seg(x2, z1, x2, z2); seg(x2, z2, x1, z2); seg(x1, z2, x1, z1);
    seg(cx, z1, cx, z2);
    var cpts = [];
    for (var i = 0; i <= 56; i++) {
      var a = i / 56 * Math.PI * 2;
      cpts.push([cx + Math.cos(a) * 9.15, cz + Math.sin(a) * 9.15]);
    }
    scene.add(new THREE.Mesh(ribbonGeometry(cpts, 0.12, y, 1), whiteLineMat));
    var pbw = Math.min(40.32, pw * 0.62), pbd = Math.min(16.5, pl * 0.17);
    var gbw = Math.min(18.32, pw * 0.3), gbd = Math.min(5.5, pl * 0.07);
    [-1, 1].forEach(function (sgn) {
      var zz = sgn < 0 ? z1 : z2;
      var dir = sgn < 0 ? 1 : -1;
      seg(cx - pbw / 2, zz, cx + pbw / 2, zz);
      seg(cx - pbw / 2, zz, cx - pbw / 2, zz + dir * pbd);
      seg(cx + pbw / 2, zz, cx + pbw / 2, zz + dir * pbd);
      seg(cx - pbw / 2, zz + dir * pbd, cx + pbw / 2, zz + dir * pbd);
      seg(cx - gbw / 2, zz, cx + gbw / 2, zz);
      seg(cx - gbw / 2, zz, cx - gbw / 2, zz + dir * gbd);
      seg(cx + gbw / 2, zz, cx + gbw / 2, zz + dir * gbd);
      seg(cx - gbw / 2, zz + dir * gbd, cx + gbw / 2, zz + dir * gbd);
      var spts = [];
      for (var j = 0; j <= 18; j++) {
        var a2 = j / 18 * Math.PI * 2;
        spts.push([cx + Math.cos(a2) * 0.35, zz + dir * 11 + Math.sin(a2) * 0.35]);
      }
      scene.add(new THREE.Mesh(ribbonGeometry(spts, 0.14, y, 1), whiteLineMat));
    });
  }

  D.landscape.forEach(function (l) {
    if (!l.pitch || l.water) return;
    // 田径场：红色胶面 + 8 道白线 + 内场草地 + 足球场标线
    if (l.sport === "running" && l.rings.length > 1) {
      var track = flatPolygonMesh([l.rings[0]], 0xffffff, 0.22, 1.0);
      applyCanvasTex(track, trackTex);
      scene.add(track);
      var field = flatPolygonMesh([l.rings[1]], 0xffffff, 0.26, 1.0);
      applyCanvasTex(field, grassTex);
      scene.add(field);
      addTrackMarkings(l.rings[0], l.rings[1]);
      addPitch(l.rings[1]);
      return;
    }
    scene.add(flatPolygonMesh(l.rings, col(PITCH_COLOR[l.sport] || 0x4f7a52), 0.25, 1.0));
    if (l.sport) {
      l.rings.forEach(function (ring) {
        var pts = ring.map(function (p) { return new THREE.Vector3(p[0], 0.36, p[1]); });
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0xf2f6f4, transparent: true, opacity: 0.55 })
        ));
      });
    }
  });

  D.landscape.forEach(function (l) {
    if (!l.water) return;
    scene.add(flatPolygonMesh(l.rings, col(0x4a86a8), 0.45, 0.92));
  });

  // 湖面（OSM relation，ODbL）
  if (D.waterPolygons) {
    D.waterPolygons.forEach(function (w) {
      scene.add(flatPolygonMesh(w.rings, col(0x2f6f8c), 0.5, 0.95));
      // 岸线
      w.rings.forEach(function (ring) {
        var pts = ring.map(function (p) { return new THREE.Vector3(p[0], 0.62, p[1]); });
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x86c6dd, transparent: true, opacity: 0.7 })
        ));
      });
    });
  }

  // 河道 / 水渠（OSM，ODbL）
  if (D.water) {
    D.water.forEach(function (w) {
      w.lines.forEach(function (pts) {
        var g = ribbonGeometry(pts, w.kind === "canal" ? 7 : 11, 0.55);
        scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
          color: col(0x3f7f96), side: THREE.DoubleSide, transparent: true, opacity: 0.92
        })));
      });
    });
  }

  var roadGroup = new THREE.Group();
  var ROAD_W = { primary: 7, secondary: 6, tertiary: 5, residential: 4.5, service: 3.5, footway: 2.2, path: 2.2, steps: 2.2, track: 3 };

  // ---- 路面贴图（B3）：沥青底 + 主路双黄线 / 次路白虚线 ----
  var roadTexCache = {};
  function roadTexture(level) {
    if (roadTexCache[level]) return roadTexCache[level];
    var W = 64, H = 256;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.fillStyle = "#3d4144";
    g.fillRect(0, 0, W, H);

    var rnd = rng(77001);
    for (var i = 0; i < 2000; i++) {
      var v = 44 + rnd() * 42;
      g.fillStyle = "rgba(" + (v | 0) + "," + ((v + 2) | 0) + "," + ((v + 5) | 0) + ",0.22)";
      g.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
    }

    if (level === "primary") {
      g.fillStyle = "#d8b44a";
      g.fillRect(W / 2 - 3, 0, 2, H);
      g.fillRect(W / 2 + 1, 0, 2, H);
      g.fillStyle = "rgba(232,238,238,0.55)";
      g.fillRect(2, 0, 1.6, H);
      g.fillRect(W - 3.6, 0, 1.6, H);
    } else if (level === "secondary" || level === "tertiary") {
      g.fillStyle = "rgba(238,242,242,0.72)";
      for (var y2 = 0; y2 < H; y2 += 28) g.fillRect(W / 2 - 1, y2, 2, 15);
      g.fillStyle = "rgba(228,234,234,0.35)";
      g.fillRect(2, 0, 1.2, H);
      g.fillRect(W - 3.2, 0, 1.2, H);
    } else {
      g.fillStyle = "rgba(226,232,232,0.22)";
      g.fillRect(2, 0, 1, H);
      g.fillRect(W - 3, 0, 1, H);
    }

    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    roadTexCache[level] = t;
    return t;
  }

  var roadMatCache = {};
  var sidewalkMat = new THREE.MeshLambertMaterial({ color: col(0xb2b6ab), side: THREE.DoubleSide });

  var MAIN_ROAD = { primary: 1, primary_link: 1, secondary: 1, secondary_link: 1, tertiary: 1 };

  D.roads.forEach(function (r) {
    if (r.tunnel) return;
    var level = r.highway || "service";
    var w = ROAD_W[level] || 3;
    if (!roadMatCache[level]) {
      roadMatCache[level] = new THREE.MeshLambertMaterial({
        map: roadTexture(level), side: THREE.DoubleSide
      });
    }
    r.lines.forEach(function (pts) {
      // 主/次干道两侧加人行道，先在下面铺一条更宽的浅色带
      if (MAIN_ROAD[level]) {
        var sw = new THREE.Mesh(ribbonGeometry(pts, w + 2.8, 0.56, 12), sidewalkMat);
        sw.name = "sidewalk:" + level;
        roadGroup.add(sw);
      }
      var rm = new THREE.Mesh(ribbonGeometry(pts, w, 0.6, 12), roadMatCache[level]);
      rm.name = "road:" + level;
      roadGroup.add(rm);
    });
  });
  scene.add(roadGroup);

  // 路灯（B6）：沿主干道每约 60 m 一盏，实例化，不增加 draw call 压力
  var lampCount = 0;
  (function streetLamps() {
    var positions = [];
    D.roads.forEach(function (r) {
      if (r.tunnel || !MAIN_ROAD[r.highway]) return;
      r.lines.forEach(function (pts) {
        var acc = 0;
        for (var i = 1; i < pts.length; i++) {
          var dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1];
          var L = Math.hypot(dx, dz);
          if (L < 1e-6) continue;
          acc += L;
          if (acc >= 60) {
            acc = 0;
            var nx = -dz / L, nz = dx / L;
            positions.push([pts[i][0] + nx * 5.4, pts[i][1] + nz * 5.4]);
          }
        }
      });
    });
    if (!positions.length) return;

    var postGeo = new THREE.CylinderGeometry(0.11, 0.15, 6.2, 6);
    postGeo.translate(0, 3.1, 0);
    var headGeo = new THREE.BoxGeometry(1.0, 0.26, 0.4);
    headGeo.translate(0.4, 6.25, 0);

    var postMat = new THREE.MeshLambertMaterial({ color: col(0x4a4f52) });
    var headMat = new THREE.MeshLambertMaterial({ color: col(0xd6dad8) });
    var posts = new THREE.InstancedMesh(postGeo, postMat, positions.length);
    var heads = new THREE.InstancedMesh(headGeo, headMat, positions.length);

    var mtx = new THREE.Matrix4();
    for (var k = 0; k < positions.length; k++) {
      mtx.makeTranslation(positions[k][0], 0.2, positions[k][1]);
      posts.setMatrixAt(k, mtx);
      heads.setMatrixAt(k, mtx);
    }
    posts.castShadow = true;
    scene.add(posts);
    scene.add(heads);
    lampCount = positions.length;
  })();

  // 地下隧道（青色）：跨南北校区的唯一通道
  var tunnelGroup = new THREE.Group();
  var tunnelBox = null;
  D.roads.forEach(function (r) {
    if (!r.tunnel) return;
    r.lines.forEach(function (pts) {
      var g = ribbonGeometry(pts, 16, 1.35);
      tunnelGroup.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        color: 0x2fd0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false
      })));
      var ends = [pts[0], pts[pts.length - 1]];
      ends.forEach(function (p) {
        var ring = new THREE.Mesh(
          new THREE.TorusGeometry(6, 1.4, 8, 20),
          new THREE.MeshBasicMaterial({ color: 0x2fd0ff })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(p[0], 1.6, p[1]);
        tunnelGroup.add(ring);
      });
      pts.forEach(function (p) {
        if (!tunnelBox) { tunnelBox = [p[0], p[1], p[0], p[1]]; return; }
        tunnelBox[0] = Math.min(tunnelBox[0], p[0]);
        tunnelBox[1] = Math.min(tunnelBox[1], p[1]);
        tunnelBox[2] = Math.max(tunnelBox[2], p[0]);
        tunnelBox[3] = Math.max(tunnelBox[3], p[1]);
      });
    });
  });
  scene.add(tunnelGroup);
  window.__navDebug = { camera: camera, controls: controls, tunnelBox: tunnelBox, scene: scene, renderer: renderer };
  window.__navDebug.lampCount = lampCount;

  // ============================================================
  // 5.5 植被（行道树 / 绿地乔木）
  // ============================================================
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function pointInRing(x, z, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], zi = ring[i][1], xj = ring[j][0], zj = ring[j][1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }

  function insideAnyBuilding(x, z, pad) {
    for (var k = 0; k < D.buildings.length; k++) {
      var b = D.buildings[k];
      for (var r = 0; r < b.rings.length; r++) {
        var ring = b.rings[r];
        if (pointInRing(x, z, ring)) return true;
        if (pad) {
          for (var i = 0; i < ring.length; i++) {
            var p = ring[i];
            if ((p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z) < pad * pad) return true;
          }
        }
      }
    }
    return false;
  }

  function insideWater(x, z) {
    if (!D.waterPolygons) { return false; }
    for (var i = 0; i < D.waterPolygons.length; i++) {
      var rings = D.waterPolygons[i].rings;
      for (var j = 0; j < rings.length; j++) {
        if (pointInRing(x, z, rings[j])) { return true; }
      }
    }
    return false;
  }

  function insidePitch(x, z) {
    for (var i = 0; i < D.landscape.length; i++) {
      var l = D.landscape[i];
      if (!l.pitch || l.water) { continue; }
      for (var j = 0; j < l.rings.length; j++) {
        if (pointInRing(x, z, l.rings[j])) { return true; }
      }
    }
    return false;
  }

  (function vegetation() {
    var rand = rng(20261018);
    var pts = [];

    // 到最近道路中心线的距离（米）：树不能长在路面上，否则第一人称漫游会被树干挡死
    function distToRoad(px, pz) {
      var best = 1e9;
      for (var ri = 0; ri < D.roads.length; ri++) {
        var r = D.roads[ri];
        if (r.tunnel) continue;
        for (var li = 0; li < r.lines.length; li++) {
          var line = r.lines[li];
          for (var i = 0; i < line.length - 1; i++) {
            var a = line[i], b = line[i + 1];
            var dx = b[0] - a[0], dz = b[1] - a[1];
            var L2 = dx * dx + dz * dz;
            var t = L2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / L2 : 0;
            if (t < 0) t = 0; else if (t > 1) t = 1;
            var d = Math.hypot(a[0] + dx * t - px, a[1] + dz * t - pz);
            if (d < best) best = d;
          }
        }
      }
      return best;
    }

    // 1) 行道树：沿道路两侧交替布置
    D.roads.forEach(function (r) {
      if (r.tunnel) return;
      r.lines.forEach(function (line) {
        var acc = 0, side = 1;
        for (var i = 0; i < line.length - 1; i++) {
          var a = line[i], b = line[i + 1];
          var dx = b[0] - a[0], dz = b[1] - a[1];
          var L = Math.hypot(dx, dz);
          if (L < 0.5) continue;
          var step = 15;
          for (var t = step - acc; t < L; t += step) {
            side = -side;
            var f = t / L;
            var x = a[0] + dx * f, z = a[1] + dz * f;
            var nx = -dz / L * 7.5 * side, nz = dx / L * 7.5 * side;
            var px = x + nx, pz = z + nz;
            if (insideAnyBuilding(px, pz, 1.5)) continue;
            if (insideWater(px, pz)) continue;
            if (insidePitch(px, pz)) continue;
            if (distToRoad(px, pz) < 4.5) continue;
            var inCampus = false;
            for (var bi = 0; bi < D.boundary.length; bi++) {
              if (pointInRing(px, pz, D.boundary[bi])) { inCampus = true; break; }
            }
            if (!inCampus) continue;
            pts.push([px, pz, 0.8 + rand() * 0.5]);
          }
          acc = (acc + L) % 15;
        }
      });
    });

    // 2) 绿地散树
    for (var n = 0; n < 700; n++) {
      var x = minX + rand() * spanX, z = minZ + rand() * spanZ;
      var ok = false;
      for (var bi2 = 0; bi2 < D.boundary.length; bi2++) {
        if (pointInRing(x, z, D.boundary[bi2])) { ok = true; break; }
      }
      if (!ok) continue;
      if (insideAnyBuilding(x, z, 3)) continue;
      if (insideWater(x, z)) continue;
      if (insidePitch(x, z)) continue;
      if (distToRoad(x, z) < 6) continue;
      pts.push([x, z, 0.75 + rand() * 0.6]);
    }

    var trunkGeo = new THREE.CylinderGeometry(0.30, 0.46, 4.6, 6);
    trunkGeo.translate(0, 2.3, 0);
    /* 树冠：二十面体细分一级（80 面）比原来的 20 面圆得多；
     * 再把顶点按「方向哈希」做径向扰动，得到不那么规整的团块状轮廓。
     * 哈希按方向取值，所以同一位置的重复顶点位移一致，不会裂开。
     */
    var crownGeo = new THREE.IcosahedronGeometry(3.1, 1);
    (function jitterCrown(geo) {
      var pos = geo.attributes.position;
      function h3(x, y, z) {
        var s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
        return s - Math.floor(s);
      }
      for (var vi = 0; vi < pos.count; vi++) {
        var vx = pos.getX(vi), vy = pos.getY(vi), vz = pos.getZ(vi);
        var len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
        var nx = vx / len, ny = vy / len, nz = vz / len;
        var k = 0.86 + h3(Math.round(nx * 500), Math.round(ny * 500), Math.round(nz * 500)) * 0.30;
        pos.setXYZ(vi, vx * k, vy * (0.88 + k * 0.14), vz * k);
      }
      geo.computeVertexNormals();
      geo.translate(0, 6.6, 0);
    })(crownGeo);

    var trunkMat = new THREE.MeshLambertMaterial({ color: col(0x6b5340) });
    var crownMat = new THREE.MeshLambertMaterial({ color: col(0x3f6b3c), flatShading: true });
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pts.length);
    var crowns = new THREE.InstancedMesh(crownGeo, crownMat, pts.length);
    var m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    var color = new THREE.Color();
    for (var i2 = 0; i2 < pts.length; i2++) {
      var p = pts[i2];
      v.set(p[0], 0.2, p[1]);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      s.set(p[2], p[2] * (0.9 + rand() * 0.35), p[2]);
      m.compose(v, q, s);
      trunks.setMatrixAt(i2, m);
      crowns.setMatrixAt(i2, m);
      color.setHSL(0.28 + rand() * 0.06, 0.34 + rand() * 0.16, 0.34 + rand() * 0.10).convertSRGBToLinear();
      crowns.setColorAt(i2, color);
    }
    trunks.castShadow = true; crowns.castShadow = true;
    crowns.receiveShadow = true;
    scene.add(trunks);
    scene.add(crowns);
    window.__navDebug.treeCount = pts.length;
  })();

  // ============================================================
  // 6. 建筑（真实轮廓 + 立面开窗 / 女儿墙 / 屋顶设备）
  // ============================================================
  // 立面配色依据官方校园风光照片（教学楼群：米白瓷砖 + 红褐砖柱；
  // 图书馆：红褐石材 + 青绿玻璃幕墙；体育馆：浅灰金属板）
  var TYPE_STYLE = {
    academic:  { kind: "ribbon",  wall: "#c4bba8", accent: "#9c4f39", glass: "#3a4a52", roof: "#6a6f73" },
    dormitory: { kind: "punch",   wall: "#cbbd9f", accent: "#b9a888", glass: "#414e57", roof: "#6a6f73" },
    library:   { kind: "curtain", wall: "#854b39", accent: "#6f3b2b", glass: "#2f5a58", roof: "#5d6165" },
    canteen:   { kind: "large",   wall: "#a4644c", accent: "#8f4f3c", glass: "#3c4a50", roof: "#63676b" },
    sports:    { kind: "panel",   wall: "#b3bfc7", accent: "#8799a6", glass: "#6b8496", roof: "#767f85" },
    culture:   { kind: "ribbon",  wall: "#b9a684", accent: "#9c4f39", glass: "#3a4a52", roof: "#6a6f73" },
    clinic:    { kind: "punch",   wall: "#cfd6da", accent: "#b9c2c7", glass: "#47545c", roof: "#71757a" },
    other:     { kind: "punch",   wall: "#b6b1a5", accent: "#a49e90", glass: "#454f56", roof: "#6a6f73" }
  };

  var STYLE_OVERRIDE = {
    B002: { kind: "curtain", wall: "#854b39", accent: "#6f3b2b", glass: "#2f5a58", roof: "#5d6165" },
    B001: { kind: "ribbon", wall: "#c2b69b", accent: "#8f4a36" },
    B031: { kind: "panel", wall: "#c6d0d7", accent: "#8496a3", roof: "#767f85" },
    B032: { kind: "ribbon", wall: "#bca887", accent: "#94503c" }
  };

  var texCache = {};
  function facadeTexture(style) {
    var key = style.kind + "|" + style.wall + "|" + style.accent + "|" + style.glass;
    if (texCache[key]) return texCache[key];

    var S = 128;
    var cv = document.createElement("canvas");
    cv.width = cv.height = S;
    var g = cv.getContext("2d");

    g.fillStyle = style.wall;
    g.fillRect(0, 0, S, S);

    // 瓷砖/石材分隔缝
    g.strokeStyle = "rgba(0,0,0,0.045)";
    g.lineWidth = 1;
    for (var yy = 0; yy < S; yy += 16) {
      g.beginPath(); g.moveTo(0, yy + 0.5); g.lineTo(S, yy + 0.5); g.stroke();
    }

    if (style.kind === "ribbon") {
      // 横向带窗 + 红褐砖柱
      g.fillStyle = style.glass;
      g.fillRect(7, 36, S - 14, 52);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(7, 36, S - 14, 12);
      g.fillStyle = style.accent;
      g.fillRect(0, 30, 7, 64);
      g.fillRect(S - 7, 30, 7, 64);
      for (var x1 = 7; x1 < S - 12; x1 += 30) g.fillRect(x1 + 26, 36, 3, 52);
      g.fillStyle = "rgba(0,0,0,0.10)";
      g.fillRect(4, 88, S - 8, 4);
    } else if (style.kind === "punch") {
      // 规则方窗 + 窗台
      g.fillStyle = style.accent;
      g.fillRect(14, 30, 34, 54);
      g.fillRect(76, 30, 34, 54);
      g.fillStyle = style.glass;
      g.fillRect(17, 33, 28, 48);
      g.fillRect(79, 33, 28, 48);
      g.fillStyle = "rgba(255,255,255,0.16)";
      g.fillRect(17, 33, 28, 9);
      g.fillRect(79, 33, 28, 9);
      g.fillStyle = "rgba(0,0,0,0.10)";
      g.fillRect(12, 86, 38, 4);
      g.fillRect(74, 86, 38, 4);
    } else if (style.kind === "curtain") {
      // 玻璃幕墙 + 竖向石材分格
      g.fillStyle = style.glass;
      g.fillRect(0, 0, S, S);
      g.fillStyle = "rgba(255,255,255,0.10)";
      g.fillRect(0, 8, S, 18);
      g.fillStyle = style.accent;
      g.fillRect(0, 0, 9, S);
      g.fillRect(S - 9, 0, 9, S);
      g.fillRect(0, S - 12, S, 12);
      g.fillStyle = "rgba(0,0,0,0.16)";
      for (var x2 = 26; x2 < S - 10; x2 += 34) g.fillRect(x2, 0, 2, S);
      g.fillStyle = "rgba(255,255,255,0.05)";
      g.fillRect(9, 0, S - 18, 3);
    } else if (style.kind === "large") {
      // 食堂：大玻璃窗 + 砖砌墙垛
      g.fillStyle = style.accent;
      g.fillRect(0, 0, S, 20);
      g.fillStyle = style.glass;
      g.fillRect(8, 26, S - 16, 78);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(8, 26, S - 16, 16);
      g.fillStyle = style.accent;
      g.fillRect(0, 0, 8, S);
      g.fillRect(S - 8, 0, 8, S);
      for (var x3 = 8; x3 < S - 12; x3 += 40) g.fillRect(x3 + 36, 26, 4, 78);
      g.fillStyle = "rgba(0,0,0,0.14)";
      g.fillRect(0, 104, S, 6);
    } else {
      // 体育场馆：金属板 + 条形高窗
      g.fillStyle = style.wall;
      g.fillRect(0, 0, S, S);
      g.fillStyle = "rgba(0,0,0,0.05)";
      for (var x4 = 0; x4 < S; x4 += 22) g.fillRect(x4, 0, 1, S);
      g.fillStyle = style.glass;
      g.fillRect(10, 22, S - 20, 30);
      g.fillStyle = "rgba(255,255,255,0.14)";
      g.fillRect(10, 22, S - 20, 8);
      g.fillStyle = style.accent;
      g.fillRect(0, S - 18, S, 18);
    }

    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    tex.encoding = THREE.sRGBEncoding;
    texCache[key] = tex;
    return tex;
  }

  function styleFor(b) {
    var base = TYPE_STYLE[b.type] || TYPE_STYLE.other;
    var ov = STYLE_OVERRIDE[b.id];
    if (!ov) return base;
    var out = {};
    for (var k in base) out[k] = base[k];
    for (var k2 in ov) out[k2] = ov[k2];
    return out;
  }

  // 立面墙：每个环按边生成四边形，UV 按真实米数展开（1 贴图 = 3.6m 开间 × 3.6m 层高）
  var BAY_M = 3.6, FLOOR_M = 3.6;
  function wallGeometry(rings, height) {
    var pos = [], uv = [], idx = [];
    var vcount = 0;
    rings.forEach(function (ring) {
      var n = ring.length;
      if (n < 3) return;
      var cx = 0, cz = 0;
      for (var i = 0; i < n; i++) { cx += ring[i][0]; cz += ring[i][1]; }
      cx /= n; cz /= n;

      var cum = 0;
      for (var j = 0; j < n; j++) {
        var p0 = ring[j], p1 = ring[(j + 1) % n];
        var dx = p1[0] - p0[0], dz = p1[1] - p0[1];
        var len = Math.hypot(dx, dz);
        if (len < 0.05) continue;

        var nx = dz / len, nz = -dx / len;
        var mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
        if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }

        var u0 = cum / BAY_M, u1 = (cum + len) / BAY_M;
        var v1 = height / FLOOR_M;

        // 逆时针（自外向内看）：p0 底 → p0 顶 → p1 顶 → p1 底
        pos.push(p0[0], 0, p0[1], p0[0], height, p0[1], p1[0], height, p1[1], p1[0], 0, p1[1]);
        uv.push(u0, 0, u0, v1, u1, v1, u1, 0);
        idx.push(vcount, vcount + 1, vcount + 2, vcount, vcount + 2, vcount + 3);
        vcount += 4;
        cum += len;
      }
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // 女儿墙：屋顶边缘一圈 0.9m 高的薄墙（向外扩 0.18m 避免 z-fighting）
  function parapetGeometry(rings, height) {
    var pos = [], idx = [], vcount = 0;
    rings.forEach(function (ring) {
      var n = ring.length;
      if (n < 3) return;
      var cx = 0, cz = 0;
      for (var i = 0; i < n; i++) { cx += ring[i][0]; cz += ring[i][1]; }
      cx /= n; cz /= n;
      for (var j = 0; j < n; j++) {
        var p0 = ring[j], p1 = ring[(j + 1) % n];
        var dx = p1[0] - p0[0], dz = p1[1] - p0[1];
        var len = Math.hypot(dx, dz);
        if (len < 0.05) continue;
        var nx = dz / len, nz = -dx / len;
        var mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
        if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
        var ox = nx * 0.18, oz = nz * 0.18;
        var y0 = height - 0.25, y1 = height + 0.65;
        pos.push(
          p0[0] + ox, y0, p0[1] + oz,
          p0[0] + ox, y1, p0[1] + oz,
          p1[0] + ox, y1, p1[1] + oz,
          p1[0] + ox, y0, p1[1] + oz
        );
        idx.push(vcount, vcount + 1, vcount + 2, vcount, vcount + 2, vcount + 3);
        vcount += 4;
      }
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  var buildingMeshes = [];
  var procedural = new THREE.Group();   // 程序化几何（GLB 加载成功后会被替换）
  scene.add(procedural);
  var roofDetailGroup = new THREE.Group();
  procedural.add(roofDetailGroup);

  D.buildings.forEach(function (b) {
    // 子建筑（如八角楼）的轮廓本来就长在母楼里，GLB 已经把它挤出成型，
    // 这里再建一遍会和母楼重面闪烁，所以只画它的屋顶冠
    if (b.sub) return;
    // 南校图书馆改用 library-model.js 的地标模型，跳过旧的程序化体块
    if (b.id === "B002" && CAMPUS !== "north") return;
    // 南校体育馆改用 gym-model.js 的地标模型，跳过旧的程序化体块
    if (b.id === "B031" && CAMPUS !== "north") return;
    // 南校学术交流中心改用 academic-model.js 的地标模型
    if (b.id === "B041" && CAMPUS !== "north") return;
    // 南校实验楼 A-E 区改用 lab-model.js 的地标模型
    if (b.id.indexOf("B045") === 0 && CAMPUS !== "north") return;
    // 南校教学楼 A-G 改用 teaching-model.js 的参数化模型
    if (CAMPUS !== "north" && ["B033", "B034", "B036", "B037", "B038E", "B038F", "B038G"].indexOf(b.id) >= 0) return;
    // 南苑/北苑宿舍改用 dorm-model.js 的参数化模型
    if (CAMPUS !== "north" && ["B005", "B006", "B007", "B008", "B009", "B010", "B011", "B013", "B014", "B015", "B016", "B017", "B018"].indexOf(b.id) >= 0) return;
    var st = styleFor(b);
    var tex = facadeTexture(st);

    // 立面
    var wallMat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.88, metalness: 0.02, color: 0xffffff
    });
    var walls = new THREE.Mesh(wallGeometry(b.rings, b.height), wallMat);
    walls.castShadow = true;
    walls.receiveShadow = true;
    walls.userData.building = b;
    procedural.add(walls);
    buildingMeshes.push(walls);

    // 屋顶
    b.rings.forEach(function (ring) {
      var shape = ringToShape(ring);
      if (!shape) return;
      var geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, b.height, 0);
      var roof = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: col(st.roof), roughness: 0.95, metalness: 0.02
      }));
      roof.receiveShadow = true;
      roof.castShadow = true;
      roof.userData.building = b;
      procedural.add(roof);
      buildingMeshes.push(roof);
    });

    // 女儿墙
    var par = new THREE.Mesh(parapetGeometry(b.rings, b.height), new THREE.MeshStandardMaterial({
      color: col(st.accent), roughness: 0.9
    }));
    par.castShadow = true;
    procedural.add(par);

    // 屋顶设备（按 id 决定，避免随机抖动）
    var seed = 0;
    for (var ci = 0; ci < b.id.length; ci++) seed += b.id.charCodeAt(ci) * (ci + 3);
    var rand = rng(seed);
    if (b.area > 1200 && b.type !== "sports") {
      var nBox = 2 + Math.floor(rand() * 3);
      var ring = b.rings[0];
      var minbx = Infinity, maxbx = -Infinity, minbz = Infinity, maxbz = -Infinity;
      ring.forEach(function (p) {
        minbx = Math.min(minbx, p[0]); maxbx = Math.max(maxbx, p[0]);
        minbz = Math.min(minbz, p[1]); maxbz = Math.max(maxbz, p[1]);
      });
      for (var k = 0; k < nBox; k++) {
        var w = 3 + rand() * 4, d = 3 + rand() * 4, h = 1.2 + rand() * 1.6;
        var px = minbx + 2 + rand() * Math.max(1, (maxbx - minbx) - 4);
        var pz = minbz + 2 + rand() * Math.max(1, (maxbz - minbz) - 4);
        if (!pointInRing(px, pz, ring)) continue;
        var box = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshStandardMaterial({ color: col(0xb0b4b6), roughness: 0.9 })
        );
        box.position.set(px, b.height + h / 2, pz);
        box.castShadow = true;
        roofDetailGroup.add(box);
      }
    }
  });

  // 子建筑（八角楼）：母楼 GLB 已经把八边形挤出来了，这里只加一圈屋顶冠，
  // 让它在一片方盒子里一眼能认出来是"那栋八个角的楼"
  (function addSubPlaceCrowns() {
    var crownGroup = new THREE.Group();
    crownGroup.name = "subPlaceCrowns";
    var capMat = new THREE.MeshStandardMaterial({ color: col(0x8f979c), roughness: 0.72, metalness: 0.12 });
    var bandMat = new THREE.MeshStandardMaterial({ color: col(0x3f4750), roughness: 0.85 });
    D.buildings.forEach(function (b) {
      if (!b.sub || !b.rings || !b.rings[0]) return;
      var ring = b.rings[0];
      var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      ring.forEach(function (p) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minZ) minZ = p[1];
        if (p[1] > maxZ) maxZ = p[1];
      });
      var cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      var r = Math.min(maxX - minX, maxZ - minZ) / 2;
      if (r < 3) return;
      var base = b.parent ? (D.buildings.filter(function (x) { return x.id === b.parent; })[0] || {}).height || b.height : b.height;
      // 八边形冠：比楼体略收进，顶部收一个小斜面，像会场的屋面
      var capH = 2.6;
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.98, capH, 8, 1, false), capMat);
      cap.position.set(cx, base + capH / 2, cz);
      cap.rotation.y = Math.PI / 8;
      cap.castShadow = true;
      cap.receiveShadow = true;
      cap.userData.building = b;
      crownGroup.add(cap);
      var band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, 0.9, 8, 1, true), bandMat);
      band.position.set(cx, base - 0.45, cz);
      band.rotation.y = Math.PI / 8;
      band.userData.building = b;
      crownGroup.add(band);
      var tip = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, 1.8, 8), capMat);
      tip.position.set(cx, base + capH + 0.9, cz);
      tip.rotation.y = Math.PI / 8;
      tip.castShadow = true;
      crownGroup.add(tip);
    });
    scene.add(crownGroup);
    window.__navDebug.subCrowns = crownGroup.children.length;
  })();

  // 南校图书馆：用 library-model.js 的白天外景地标模型替换旧体块
  var landmarkMeshes = [];
  var landmarkGroup = null;
  if (CAMPUS !== "north" && typeof window.buildGDUFSLibrary === "function") {    var b002 = null;
    for (var b2i = 0; b2i < D.buildings.length; b2i++) {
      if (D.buildings[b2i].id === "B002") { b002 = D.buildings[b2i]; break; }
    }
    if (b002) {
      landmarkGroup = window.buildGDUFSLibrary();
      // 本地正面朝 -z，直接朝向默认相机（南侧主广场）；主体向北落进 B002 轮廓
      landmarkGroup.scale.set(0.9, 1.0, 1.8);
      landmarkGroup.rotation.y = 0;
      landmarkGroup.position.set(94.3, 0, 117);
      landmarkGroup.traverse(function (o) {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.building = b002;
        landmarkMeshes.push(o);
        buildingMeshes.push(o);
      });
      scene.add(landmarkGroup);
    }
  }

  // 南校体育馆：B031 叶形平面 + 单叶拱壳
  var gymMeshes = [];
  var gymGroup = null;
  if (CAMPUS !== "north" && typeof window.buildGDUFSGym === "function") {
    var b031 = null;
    for (var b3i = 0; b3i < D.buildings.length; b3i++) {
      if (D.buildings[b3i].id === "B031") { b031 = D.buildings[b3i]; break; }
    }
    if (b031) {
      b031.height = 33;
      gymGroup = window.buildGDUFSGym();
      gymGroup.rotation.y = 0;
      gymGroup.position.set(104.4, 0, 613.75);
      gymGroup.traverse(function (o) {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.building = b031;
        gymMeshes.push(o);
        buildingMeshes.push(o);
      });
      scene.add(gymGroup);
    }
  }

  // 南校学术交流中心：B041 临河橙色长楼
  var academicMeshes = [];
  var academicGroup = null;
  if (CAMPUS !== "north" && typeof window.buildGDUFSAcademic === "function") {
    var b041 = null;
    for (var b4i = 0; b4i < D.buildings.length; b4i++) {
      if (D.buildings[b4i].id === "B041") { b041 = D.buildings[b4i]; break; }
    }
    if (b041) {
      b041.height = 23;
      academicGroup = window.buildGDUFSAcademic();
      academicGroup.rotation.y = 0;
      academicGroup.position.set(-224.3, 0, -309.25);
      academicGroup.traverse(function (o) {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.building = b041;
        academicMeshes.push(o);
        buildingMeshes.push(o);
      });
      scene.add(academicGroup);
    }
  }

  // 南校实验楼：B045A-E 五区 + 中央钟楼
  var labMeshes = [];
  var labGroup = null;
  if (CAMPUS !== "north" && typeof window.buildGDUFSLab === "function") {
    var labById = {};
    D.buildings.forEach(function (b) { if (b.id.indexOf("B045") === 0) labById[b.id] = b; });
    labGroup = window.buildGDUFSLab();
    labGroup.rotation.y = 0;
    labGroup.position.set(-193.25, 0, 112.2);
    labGroup.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      var p = o, zid = null;
      while (p && !zid) {
        if (p.userData && p.userData.buildingId) zid = p.userData.buildingId;
        p = p.parent;
      }
      var b = zid ? labById[zid] : null;
      if (b) {
        o.userData.building = b;
        labMeshes.push(o);
        buildingMeshes.push(o);
      }
    });
    scene.add(labGroup);
  }

  // 南校教学楼 A-G：与实验楼同一套橙白风格
  var teachingMeshes = [];
  var teachingGroups = [];
  if (CAMPUS !== "north" && typeof window.buildGDUFSTeaching === "function") {
    var teachingIds = ["B033", "B034", "B036", "B037", "B038E", "B038F", "B038G"];
    teachingIds.forEach(function (id) {
      var tb = null;
      for (var ti = 0; ti < D.buildings.length; ti++) {
        if (D.buildings[ti].id === id) { tb = D.buildings[ti]; break; }
      }
      if (!tb) return;
      var tg = window.buildGDUFSTeaching(tb);
      tg.traverse(function (o) {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.building = tb;
        teachingMeshes.push(o);
        buildingMeshes.push(o);
      });
      scene.add(tg);
      teachingGroups.push(tg);
    });
  }

  // 南苑 / 北苑宿舍：7 层 22.4 m，橙白 + 长边阳台
  var dormMeshes = [];
  var dormGroups = [];
  if (CAMPUS !== "north" && typeof window.buildGDUFSDorm === "function") {
    var dormIds = ["B005", "B006", "B007", "B008", "B009", "B010", "B011", "B013", "B014", "B015", "B016", "B017", "B018"];
    dormIds.forEach(function (id) {
      var db = null;
      for (var di = 0; di < D.buildings.length; di++) {
        if (D.buildings[di].id === id) { db = D.buildings[di]; break; }
      }
      if (!db) return;
      var dg = window.buildGDUFSDorm(db);
      dg.traverse(function (o) {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.building = db;
        dormMeshes.push(o);
        buildingMeshes.push(o);
      });
      scene.add(dg);
      dormGroups.push(dg);
    });
  }

  // 校门：门柱 + 横梁
  D.gates.forEach(function (g) {
    var gate = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: col(0x9c5540), roughness: 0.85 });
    var p1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.5, 2.2), mat);
    p1.position.set(-4.2, 3.25, 0);
    var p2 = p1.clone(); p2.position.x = 4.2;
    var beam = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.3, 2.0), mat);
    beam.position.set(0, 6.9, 0);
    gate.add(p1, p2, beam);
    gate.position.set(g.x, 0, g.z);
    gate.castShadow = true;
    scene.add(gate);

    var disc = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.6, 16),
      new THREE.MeshBasicMaterial({ color: 0xff6b6b })
    );
    disc.position.set(g.x, 0.8, g.z);
    scene.add(disc);
  });

  // ============================================================
  // 6.5 优先加载 Blender 导出的 LOD2 模型；失败则保留程序化几何
  // ============================================================
  (function loadDetailedModel() {
    if (!THREE.GLTFLoader) { return; }
    // 南北两个校区各有自己的 GLB；加载失败就保留程序化体块
    var glbUrl = (CAMPUS === "north")
      ? (window.GDUFS_NORTH_GLB_URL || "assets/north_buildings.glb")
      : (window.GDUFS_GLB_URL || "assets/gdufs_buildings.glb");
    var loader = new THREE.GLTFLoader();
    loader.load(glbUrl, function (gltf) {
      var byId = {};
      D.buildings.forEach(function (b) { byId[b.id] = b; });
      var tagged = 0;
      gltf.scene.traverse(function (o) {
        if (!o.isMesh) { return; }
        o.castShadow = true;
        o.receiveShadow = true;
        var tag = (o.name || "") + "|" + (o.parent ? o.parent.name : "");
        var mm = tag.match(/[BN]\d{3}[A-Z]?/);
        if (mm && (mm[0] === "B002" || mm[0] === "B031" || mm[0] === "B041" || mm[0].indexOf("B045") === 0 || ["B033","B034","B036","B037","B038E","B038F","B038G"].indexOf(mm[0]) >= 0 || ["B005","B006","B007","B008","B009","B010","B011","B013","B014","B015","B016","B017","B018"].indexOf(mm[0]) >= 0)) { o.visible = false; return; }
        var b = mm ? byId[mm[0]] : null;
        if (b) { o.userData.building = b; tagged++; }
        if (o.material && o.material.map) { o.material.map.anisotropy = 4; }
        // B5：屋面偏冷灰，屋顶设备提亮，形成层次
        if (o.material && o.material.name === "roof") {
          // 屋面已改成「碎石贴图」，这里不要再染色，否则会把贴图乘成一片死灰
          o.material.color = new THREE.Color(0xffffff);
          o.material.roughness = 0.95;
        }
        if (o.material && o.material.name === "metal") {
          o.material.color = new THREE.Color(0x8a9196);
          o.material.roughness = 0.8;
        }
      });
      scene.remove(procedural);
      scene.add(gltf.scene);
      addRoofGreenery();
      addRoofClutter();
      renderer.shadowMap.needsUpdate = true;
      buildingMeshes.length = 0;
      gltf.scene.traverse(function (o) { if (o.isMesh && o.visible) { buildingMeshes.push(o); } });
      for (var lm = 0; lm < landmarkMeshes.length; lm++) buildingMeshes.push(landmarkMeshes[lm]);
      for (var gm = 0; gm < gymMeshes.length; gm++) buildingMeshes.push(gymMeshes[gm]);
      for (var am = 0; am < academicMeshes.length; am++) buildingMeshes.push(academicMeshes[am]);
      for (var lmm = 0; lmm < labMeshes.length; lmm++) buildingMeshes.push(labMeshes[lmm]);
      for (var tm = 0; tm < teachingMeshes.length; tm++) buildingMeshes.push(teachingMeshes[tm]);
      for (var dm = 0; dm < dormMeshes.length; dm++) buildingMeshes.push(dormMeshes[dm]);
      window.__navDebug.mode = "glb";
      window.__navDebug.glbObjects = gltf.scene.children.length;
      window.__navDebug.glbTagged = tagged;
      var sub = document.querySelector("#panel .sub");
      if (sub) { sub.innerHTML = sub.innerHTML.replace("程序化立面与屋顶", "Blender LOD2 模型"); }
    }, undefined, function () {
      window.__navDebug.mode = "procedural";
    });
  })();

  // ============================================================
  // 7. 标注（HTML 叠层）
  // ============================================================
  var labelLayer = document.getElementById("labels");
  var labelItems = [];
  var labelsVisible = true;
  var tmpVec = new THREE.Vector3();

  D.buildings.slice().sort(function (a, b) { return b.area - a.area; }).forEach(function (b) {
    if (!b.name) return;
    var cx = 0, cz = 0, n = 0;
    b.rings[0].forEach(function (p) { cx += p[0]; cz += p[1]; n++; });
    var el = document.createElement("div");
    el.className = "lbl";
    el.textContent = (window.tName ? window.tName(b.name) : b.name);
    labelLayer.appendChild(el);
    labelItems.push({
      el: el, x: cx / n, y: b.height + 4, z: cz / n,
      w: b.name.length * 11.5 + 12, h: 16
    });
  });

  // 校门标注（放在建筑之后，碰撞避让时优先级较低）
  D.gates.forEach(function (g) {
    if (!g.name) return;
    var gel = document.createElement("div");
    gel.className = "lbl gate";
    gel.textContent = (window.tName ? window.tName(g.name) : g.name);
    labelLayer.appendChild(gel);
    // 校门是关键导航点，优先于建筑标注占位
    labelItems.unshift({
      el: gel, x: g.x, y: 7, z: g.z,
      w: g.name.length * 11.5 + 16, h: 16
    });
  });

  if (tunnelBox) {
    var tel = document.createElement("div");
    tel.className = "lbl";
    tel.textContent = window.GDUFS_LANG && window.GDUFS_LANG.get() === "en" ? "Underground Tunnel" : "地下隧道";
    labelLayer.appendChild(tel);
    labelItems.unshift({
      el: tel,
      x: (tunnelBox[0] + tunnelBox[2]) / 2,
      y: 9,
      z: (tunnelBox[1] + tunnelBox[3]) / 2,
      w: 64, h: 16
    });
  }

  // 标签宽度按实际渲染尺寸测量：中英文同一个地点长度差很多（"图书馆" vs "Library"），
  // 用中文字数估算会让英文标签互相压住，手机小屏上尤其明显
  for (var li = 0; li < labelItems.length; li++) {
    var lw = labelItems[li].el.offsetWidth;
    var lh = labelItems[li].el.offsetHeight;
    if (lw > 0) { labelItems[li].w = lw; }
    if (lh > 0) { labelItems[li].h = lh; }
  }

  function updateLabels() {
    if (!labelsVisible) { return; }
    var w = window.innerWidth, h = window.innerHeight;
    var placed = [];
    for (var i = 0; i < labelItems.length; i++) {
      var it = labelItems[i];
      tmpVec.set(it.x, it.y, it.z).project(camera);
      if (tmpVec.z > 1) { it.el.style.display = "none"; continue; }
      var px = (tmpVec.x * 0.5 + 0.5) * w;
      var py = (-tmpVec.y * 0.5 + 0.5) * h;
      if (px < -60 || px > w + 60 || py < -20 || py > h + 20) {
        it.el.style.display = "none"; continue;
      }
      var x0 = px - it.w / 2, x1 = px + it.w / 2;
      var y0 = py - it.h, y1 = py;
      var clash = false;
      for (var k = 0; k < placed.length; k++) {
        var q = placed[k];
        if (x0 < q[1] + 3 && x1 + 3 > q[0] && y0 < q[3] + 2 && y1 + 2 > q[2]) { clash = true; break; }
      }
      if (clash) { it.el.style.display = "none"; continue; }
      placed.push([x0, x1, y0, y1]);
      it.el.style.display = "";
      it.el.style.transform = "translate(-50%,-100%) translate(" + px.toFixed(1) + "px," + py.toFixed(1) + "px)";
    }
  }

  // ============================================================
  // 8. 道路拓扑图
  // ============================================================
  // 北校区路网尚未数字化，D.graph 可能为空——此时算路会返回 null，界面给"暂不可用"提示
  var G = D.graph || { nodes: [], edges: [] };
  var adj = [];
  for (var ni = 0; ni < G.nodes.length; ni++) adj.push([]);
  G.edges.forEach(function (e, ei) {
    adj[e.a].push({ to: e.b, len: e.len, ei: ei, rev: false });
    adj[e.b].push({ to: e.a, len: e.len, ei: ei, rev: true });
  });

  function Heap() { this.a = []; }
  Heap.prototype.push = function (node, f) {
    var a = this.a;
    a.push([f, node]);
    var i = a.length - 1;
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      var t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      var i = 0, n = a.length;
      while (true) {
        var l = 2 * i + 1, r = l + 1, m = i;
        if (l < n && a[l][0] < a[m][0]) m = l;
        if (r < n && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        var t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top;
  };
  Heap.prototype.empty = function () { return this.a.length === 0; };

  // 沿道路图的 Dijkstra
  function shortestRoute(s, t) {
    if (s === t) return { dist: 0, seq: [] };
    var n = G.nodes.length;
    if (s < 0 || t < 0 || s >= n || t >= n) return null;   // 定位点没贴上路网时不要炸
    var dist = new Float64Array(n);
    dist.fill(Infinity);
    var prevNode = new Int32Array(n); prevNode.fill(-1);
    var prevEdge = new Int32Array(n); prevEdge.fill(-1);
    var prevRev = new Uint8Array(n);
    var done = new Uint8Array(n);

    var heap = new Heap();
    dist[s] = 0;
    heap.push(s, 0);

    while (!heap.empty()) {
      var top = heap.pop();
      var u = top[1];
      if (done[u]) continue;
      done[u] = 1;
      if (u === t) break;
      var list = adj[u];
      for (var k = 0; k < list.length; k++) {
        var e = list[k];
        var nd = dist[u] + e.len;
        if (nd < dist[e.to]) {
          dist[e.to] = nd;
          prevNode[e.to] = u;
          prevEdge[e.to] = e.ei;
          prevRev[e.to] = e.rev ? 1 : 0;
          heap.push(e.to, nd);
        }
      }
    }
    if (!isFinite(dist[t])) return null;

    var seq = [];
    var cur = t;
    while (cur !== s) {
      seq.push({ ei: prevEdge[cur], rev: prevRev[cur] });
      cur = prevNode[cur];
    }
    seq.reverse();
    return { dist: dist[t], seq: seq };
  }

  function samePoint(a, b) {
    return Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05;
  }

  // ============================================================
  // 9. 地点 / 路径
  // ============================================================
  var places = D.places.slice().sort(function (a, b) {
    return a.label.localeCompare(b.label, "zh");
  });

  var startPlace = null, endPlace = null;
  var pathGroup = new THREE.Group();
  scene.add(pathGroup);
  var markerGroup = new THREE.Group();
  scene.add(markerGroup);

  function clearGroup(g) {
    while (g.children.length) {
      var c = g.children[0];
      g.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }

  function drawMarkers() {
    clearGroup(markerGroup);
    // 「我的位置」自己有一套蓝色标记（精度圈 + 圆点），不再叠一圈绿环
    if (startPlace && startPlace !== myPlace) {
      var m1 = new THREE.Mesh(
        new THREE.TorusGeometry(4.5, 1.2, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x4cff9a })
      );
      m1.rotation.x = -Math.PI / 2;
      m1.position.set(startPlace.x, 1.4, startPlace.z);
      markerGroup.add(m1);
    }
    if (endPlace) {
      var m2 = new THREE.Mesh(
        new THREE.TorusGeometry(4.5, 1.2, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xff5a4c })
      );
      m2.rotation.x = -Math.PI / 2;
      m2.position.set(endPlace.x, 1.4, endPlace.z);
      markerGroup.add(m2);
    }
  }

  function setStatus(html) {
    document.getElementById("status").innerHTML = html;
  }

  // 距离牌：白底蓝字小胶囊，始终朝向相机
  function distanceSprite(x, z, meters) {
    var c = document.createElement("canvas");
    c.width = 192; c.height = 64;
    var g = c.getContext("2d");
    g.fillStyle = "rgba(0,70,148,0.92)";
    var r = 26, w = 192, h = 64;
    g.beginPath();
    g.moveTo(6 + r, 6);
    g.lineTo(w - 6 - r, 6);
    g.quadraticCurveTo(w - 6, 6, w - 6, 6 + r);
    g.lineTo(w - 6, h - 6 - r);
    g.quadraticCurveTo(w - 6, h - 6, w - 6 - r, h - 6);
    g.lineTo(6 + r, h - 6);
    g.quadraticCurveTo(6, h - 6, 6, h - 6 - r);
    g.lineTo(6, 6 + r);
    g.quadraticCurveTo(6, 6, 6 + r, 6);
    g.closePath();
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "600 34px 'PingFang SC','Microsoft YaHei',sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(meters + " m", w / 2, h / 2 + 1);

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, depthWrite: false
    }));
    sp.scale.set(17, 5.7, 1);
    sp.position.set(x, 7.5, z);
    sp.renderOrder = 5;
    return sp;
  }

  // 起终点地标：细杆 + 顶环
  function routePin(x, z, colorHex) {
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: colorHex });
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 7, 8), mat);
    pole.position.set(x, 3.6, z);
    g.add(pole);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.34, 8, 20), mat);
    ring.position.set(x, 7.6, z);
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    return g;
  }

  function route() {
    clearGroup(pathGroup);
    drawMarkers();
    if (!startPlace || !endPlace) {
        setStatus(window.t ? window.t("status.pick") : "请选择起点和终点（可直接点击画面中的建筑）。");
      return;
    }
    if (startPlace === endPlace) {
      setStatus('<span class="warn">起点与终点相同。</span>');
      return;
    }

    var res = shortestRoute(startPlace.node, endPlace.node);
    if (!res) {
      setStatus('<span class="warn">道路网络未连通，无法规划路径。</span>');
      return;
    }

    // 拼接沿道路的折线
    var pts = [[startPlace.x, startPlace.z]];
    for (var i = 0; i < res.seq.length; i++) {
      var e = G.edges[res.seq[i].ei];
      // 南校的边自带折线 pts；北校是 20 m 网格图，只有两个端点
      var poly = e.pts || [
        [G.nodes[e.a][0], G.nodes[e.a][1]],
        [G.nodes[e.b][0], G.nodes[e.b][1]]
      ];
      if (res.seq[i].rev) poly = poly.slice().reverse();
      for (var k = 0; k < poly.length; k++) {
        var p = poly[k];
        if (pts.length && samePoint(pts[pts.length - 1], p)) continue;
        pts.push([p[0], p[1]]);
      }
    }
    if (!samePoint(pts[pts.length - 1], [endPlace.x, endPlace.z])) {
      pts.push([endPlace.x, endPlace.z]);
    }

    // 供第一人称漫游（walk.js）取用
    window.__lastRoute = pts;
    window.__lastRouteDist = res.dist;

    // 路线：下层深橙描边 + 上层亮橙，读起来像一条"带"而不是一片"色块"
    // 抬到路面之上（路面 y=0.60、人行道 0.56），并给材质加 polygonOffset：
    // 相机 near=4 / far=14000，一千米外深度缓冲精度远小于 0.2 m，只靠抬高会被路面 z-fight 掉。
    var geoOuter = ribbonGeometry(pts, 5.4, 0.72, 12);
    pathGroup.add(new THREE.Mesh(geoOuter, new THREE.MeshBasicMaterial({
      color: 0xb8430c, side: THREE.DoubleSide, transparent: true, opacity: 0.92,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12
    })));
    var geoInner = ribbonGeometry(pts, 3.4, 0.79, 12);
    pathGroup.add(new THREE.Mesh(geoInner, new THREE.MeshBasicMaterial({
      color: 0xffa02e, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16
    })));

    // 每 100 米一个距离牌
    var accM = 0, nextMark = 100;
    for (var mi = 1; mi < pts.length; mi++) {
      accM += Math.hypot(pts[mi][0] - pts[mi - 1][0], pts[mi][1] - pts[mi - 1][1]);
      if (accM >= nextMark && nextMark <= res.dist) {
        pathGroup.add(distanceSprite(pts[mi][0], pts[mi][1], nextMark));
        nextMark += 100;
      }
    }

    // 起终点地标
    pathGroup.add(routePin(startPlace.x, startPlace.z, 0x1c7d45));
    pathGroup.add(routePin(endPlace.x, endPlace.z, 0xd11f2b));

    // 只在明显转折处画小圆点
    for (var t = 1; t < pts.length - 1; t++) {
      var ax = pts[t][0] - pts[t - 1][0], az = pts[t][1] - pts[t - 1][1];
      var bx = pts[t + 1][0] - pts[t][0], bz = pts[t + 1][1] - pts[t][1];
      var la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
      if (la < 0.5 || lb < 0.5) continue;
      var cosang = (ax * bx + az * bz) / (la * lb);
      if (cosang > 0.94) continue;
      var dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe08a })
      );
      // 贴地放：原来半径 1.8、离地 1.6 m，正好在漫游时的眼高上，
      // 相机会从球里穿过去，近裁剪面切出一个白色锯齿（第一人称下极明显）
      dot.position.set(pts[t][0], 0.62, pts[t][1]);
      pathGroup.add(dot);
    }

    var viaTunnel = false;
    if (tunnelBox) {
      for (var ti = 0; ti < pts.length; ti++) {
        if (pts[ti][0] >= tunnelBox[0] - 1 && pts[ti][0] <= tunnelBox[2] + 1 &&
            pts[ti][1] >= tunnelBox[1] - 1 && pts[ti][1] <= tunnelBox[3] + 1) {
          viaTunnel = true;
          break;
        }
      }
    }

    var _e = window.GDUFS_LANG && window.GDUFS_LANG.get() === "en";
    var _n = window.tName || function (x) { return x; };
    var mine = (startPlace === myPlace && myMeta)
      ? (_e
        ? '<br><span class="ok">from my location · ±' + Math.round(myMeta.accuracy) + ' m</span>'
        : '<br><span class="ok">起点为我的位置 · 精度 ±' + Math.round(myMeta.accuracy) + ' 米</span>')
      : "";
    setStatus(
      '<b>' + _n(startPlace.label) + '</b> → <b>' + _n(endPlace.label) + '</b><br>' +
      (_e
        ? 'Walk about <span class="ok">' + Math.round(res.dist) + ' m</span> · ' + pts.length + ' waypoints' +
          (viaTunnel ? '<br><span class="ok">via the underground tunnel</span>' : '')
        : '沿道路步行约 <span class="ok">' + Math.round(res.dist) + ' 米</span> · 途经 ' + pts.length + ' 个路点' +
          (viaTunnel ? '<br><span class="ok">经地下隧道穿行</span>' : '')) + mine
    );
  }

  // ============================================================
  // 10. 交互
  // ============================================================
  function fillSelect(sel, withMe) {
    var html = '<option value="-1">' + (window.t ? window.t("form.select") : "请选择…") + '</option>';
    // 定位过之后，起点下拉里多一项「我的位置」（value=-2，不对应 places 的下标）
    if (withMe && myPlace) {
      html += '<option value="-2">' + (window.t ? window.t("form.me") : "📍 我的位置") + '</option>';
    }
    places.forEach(function (p, i) {
      var lb = window.tName ? window.tName(p.label) : p.label;
      html += '<option value="' + i + '">' + lb + "</option>";
    });
    sel.innerHTML = html;
  }
  var startSel = document.getElementById("startSelect");
  var endSel = document.getElementById("endSelect");
  fillSelect(startSel, true);
  fillSelect(endSel);

  startSel.addEventListener("change", function () {
    var v = parseInt(this.value, 10);
    startPlace = v === -2 ? myPlace : (places[v] || null);
    route();
  });
  endSel.addEventListener("change", function () {
    endPlace = places[parseInt(this.value, 10)] || null;
    route();
  });

  function syncSelects() {
    startSel.value = startPlace
      ? (startPlace === myPlace ? "-2" : String(places.indexOf(startPlace)))
      : "-1";
    endSel.value = endPlace ? String(places.indexOf(endPlace)) : "-1";
  }

  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  renderer.domElement.addEventListener("click", function (e) {
    var rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObjects(buildingMeshes, false);
    if (!hits.length) return;
    var b = hits[0].object.userData.building;
    var place = null;
    for (var i = 0; i < places.length; i++) {
      if (places[i].kind === "building" && places[i].ref === b.id) { place = places[i]; break; }
    }
    if (window.__onBuildingClick) {
      try { window.__onBuildingClick(b); } catch (err) { /* 忽略面板异常 */ }
    }
    if (!place) { setStatus('<span class="warn">该建筑未命名，无法作为导航点。</span>'); return; }
    if (startPlace === myPlace && !endPlace) {
      // 已经定位过：点建筑直接当终点，起点保留「我的位置」
      endPlace = place;
    } else if (!startPlace || (startPlace && endPlace)) {
      startPlace = place; endPlace = null;
    } else {
      endPlace = place;
    }
    syncSelects();
    route();
  });

  document.getElementById("btnLabels").addEventListener("click", function () {
    labelsVisible = !labelsVisible;
    this.classList.toggle("on", labelsVisible);
    if (!labelsVisible) {
      for (var i = 0; i < labelItems.length; i++) labelItems[i].el.style.display = "none";
    }
  });
  document.getElementById("btnRoads").addEventListener("click", function () {
    roadGroup.visible = !roadGroup.visible;
    this.classList.toggle("on", roadGroup.visible);
  });
  document.getElementById("btnReset").addEventListener("click", resetView);

  // ============================================================
  // 11. 定位「我的位置」
  // ============================================================
  // 分工：geo.js 只负责「GPS 经纬度 → 校园本地坐标（x 西正、z 北正）」；
  // 这里负责贴路网、画标记、把「我的位置」当成一个临时起点参与算路。
  // 之所以不把坐标算进 Dify：定位是每秒钟都在变的前端状态，走一趟大模型
  // 既慢又没必要，LLM 拿不到 GPS，也不该负责画图。
  var myPlace = null;
  var myMeta = null;
  var myGroup = new THREE.Group();
  scene.add(myGroup);

  // 最近路网节点：定位点一般不在路上，用最近节点当算路起点，偏差画成接驳段
  function nearestNode(x, z) {
    var best = -1, bd = Infinity;
    for (var i = 0; i < G.nodes.length; i++) {
      var dx = G.nodes[i][0] - x, dz = G.nodes[i][1] - z;
      var d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return { node: best, dist: Math.sqrt(bd) };
  }

  function nearestPlace(x, z) {
    var best = null, bd = Infinity;
    for (var i = 0; i < places.length; i++) {
      var p = places[i];
      var d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { label: best.label, dist: bd } : null;
  }

  // 我附近的 k 个地点（不含自身），给"我附近有什么"这类问句用
  function nearbyPlaces(k) {
    if (!myPlace) return [];
    return places.map(function (p) {
      return { label: p.label, dist: Math.hypot(p.x - myPlace.x, p.z - myPlace.z), kind: p.kind };
    }).sort(function (a, b) { return a.dist - b.dist; }).slice(0, k || 3);
  }

  function myLabelSprite(text) {
    var c = document.createElement("canvas");
    c.width = 256; c.height = 72;
    var g = c.getContext("2d");
    g.fillStyle = "rgba(27,110,243,0.95)";
    var r = 20, w = 256, h = 72;
    g.beginPath();
    g.moveTo(6 + r, 6);
    g.lineTo(w - 6 - r, 6);
    g.quadraticCurveTo(w - 6, 6, w - 6, 6 + r);
    g.lineTo(w - 6, h - 6 - r);
    g.quadraticCurveTo(w - 6, h - 6, w - 6 - r, h - 6);
    g.lineTo(6 + r, h - 6);
    g.quadraticCurveTo(6, h - 6, 6, h - 6 - r);
    g.lineTo(6, 6 + r);
    g.quadraticCurveTo(6, 6, 6 + r, 6);
    g.closePath();
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "600 30px 'PingFang SC','Microsoft YaHei',sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 1);

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, depthWrite: false
    }));
    sp.scale.set(22, 6.2, 1);
    sp.renderOrder = 7;
    return sp;
  }

  function drawMyMarker(x, z, acc) {
    clearGroup(myGroup);
    // 精度圈：半径=GPS 报告的 accuracy（米），一眼看出"大概在这一片"
    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(acc, 48),
      new THREE.MeshBasicMaterial({
        color: 0x2f6ea8, transparent: true, opacity: 0.18,
        depthWrite: false, side: THREE.DoubleSide
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.55, z);
    myGroup.add(disc);

    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(4.2, Math.min(acc * 0.3, 12)), 0.9, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.8, z);
    myGroup.add(ring);

    var dot = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 24),
      new THREE.MeshBasicMaterial({ color: 0x1b6ef3, depthWrite: false })
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(x, 1.0, z);
    myGroup.add(dot);

    var sp = myLabelSprite(window.t ? window.t("me.label") : "我的位置");
    sp.position.set(x, 22, z);   // 抬到校门/建筑标注（y=7）之上，避免"正门"和"我的位置"叠在一起
    myGroup.add(sp);
  }

  function myStatusHtml() {
    var en = window.GDUFS_LANG && window.GDUFS_LANG.get() === "en";
    var _n = window.tName || function (x) { return x; };
    var near = myPlace ? nearestPlace(myPlace.x, myPlace.z) : null;
    var acc = myMeta ? Math.round(myMeta.accuracy) : 0;
    if (en) {
      return '<b>You are here</b> · ±' + acc + ' m' +
        (near ? '<br>Nearest landmark: ' + _n(near.label) + ' · ' + Math.round(near.dist) + ' m' : '') +
        '<br>Pick a destination to route from your location.';
    }
    return '<b>已定位到我的位置</b> · 精度 ±' + acc + ' 米' +
      (near ? '<br>最近的地标：' + _n(near.label) + ' · 约 ' + Math.round(near.dist) + ' 米' : '') +
      '<br>选个终点，就能从你这里开始算路。';
  }

  /**
   * 设定我的位置（xy 为校园本地坐标，单位米）
   * @param {number} x  西正（与建筑/路网同一套坐标）
   * @param {number} z  北正
   * @param {object} opt {accuracy:米, lat, lon, heading}
   */
  function setMyPosition(x, z, opt) {
    opt = opt || {};
    if (!isFinite(x) || !isFinite(z)) { return null; }
    var acc = +opt.accuracy;
    if (!isFinite(acc) || acc <= 0) { acc = 25; }
    acc = Math.max(6, Math.min(300, acc));

    var first = !myPlace;
    var moved = first ? Infinity : Math.hypot(x - myPlace.x, z - myPlace.z);

    var nn = nearestNode(x, z);
    myPlace = { label: "我的位置", x: x, z: z, node: nn.node, kind: "me" };
    myMeta = { accuracy: acc, snap: nn.dist, at: Date.now(), lat: opt.lat, lon: opt.lon };
    drawMyMarker(x, z, acc);

    startPlace = myPlace;
    fillSelect(startSel, true);
    syncSelects();
    // 连续定位时每秒重算一次路线既费性能又闪，走动了 3 m 以上才重算
    if (first || moved > 3 || !endPlace) { route(); }
    if (!endPlace) { setStatus(myStatusHtml()); }

    // 只在第一次或明显移动时推镜头，否则用户自己转视角会被抢回去
    if (window.__navDebug.flyTo && (first || moved > 60)) {
      window.__navDebug.flyTo(x, z, Math.max(90, acc * 3), Math.max(230, acc * 6));
    }
    return {
      x: x, z: z, accuracy: acc, node: nn.node,
      snap: Math.round(nn.dist * 10) / 10,
      routed: !!endPlace
    };
  }

  function clearMyPosition() {
    if (!myPlace) { return; }
    if (startPlace === myPlace) { startPlace = null; }
    myPlace = null;
    myMeta = null;
    clearGroup(myGroup);
    fillSelect(startSel, true);
    syncSelects();
    route();
  }

  window.__navDebug.setMyPosition = setMyPosition;
  window.__navDebug.clearMyPosition = clearMyPosition;
  window.__navDebug.getMyPosition = function () {
    if (!myPlace) { return null; }
    return {
      x: myPlace.x, z: myPlace.z, node: myPlace.node,
      accuracy: myMeta ? myMeta.accuracy : 0,
      snap: myMeta ? Math.round(myMeta.snap * 10) / 10 : 0,
      nearest: nearestPlace(myPlace.x, myPlace.z)
    };
  };
  window.__navDebug.nearestPlace = function () {
    return myPlace ? nearestPlace(myPlace.x, myPlace.z) : null;
  };
  window.__navDebug.nearbyPlaces = nearbyPlaces;
  window.__navDebug.nearestNode = nearestNode;

  // ============================================================
  // 12. 渲染循环
  // ============================================================
  var needle = document.getElementById("needle");
  var camDir = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);
    // 漫游（walk.js）接管相机时，暂停轨道控制与相机飞行，避免互相覆盖
    if (!window.__walkActive) {
      tickFly();
      controls.update();
    }
    renderer.render(scene, camera);
    updateLabels();
    camera.getWorldDirection(camDir);
    var ang = Math.atan2(camDir.x, camDir.z) * 180 / Math.PI;
    needle.style.transform = "rotate(" + (-ang).toFixed(1) + "deg)";
  }

  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ============================================================
  // 12. 对外接口（供 AI 面板调用）
  // ============================================================
  function normPlace(s) {
    return (s || "").replace(/[（(].*?[）)]/g, "").replace(/[\s·、,，]/g, "").toLowerCase();
  }

  // 常见别称 / 口语说法 → 规范地点名
  var PLACE_ALIAS = {
    "一饭": "文采园", "一食堂": "文采园", "第一饭堂": "文采园",
    "二饭": "博雅园", "二食堂": "博雅园", "第二饭堂": "博雅园",
    "三饭": "风采园", "三食堂": "风采园", "第三饭堂": "风采园",
    "校医院": "门诊部", "医院": "门诊部", "医务室": "门诊部",
    "大礼堂": "大会堂", "会堂": "大会堂", "礼堂": "大会堂",
    "羽球馆": "体育馆", "羽毛球馆": "体育馆",
    "主校门": "正门", "大门": "正门", "北门": "正门",
    "教a": "教学楼A栋", "教b": "教学楼B栋", "教c": "教学楼C栋", "教d": "教学楼D栋",
    "教e": "教学楼E栋", "教f": "教学楼F栋", "教g": "教学楼G栋"
  };

  function expandAlias(n) {
    if (PLACE_ALIAS[n]) { return PLACE_ALIAS[n]; }
    for (var k in PLACE_ALIAS) {
      if (n.indexOf(k) >= 0) { return n.replace(k, PLACE_ALIAS[k]); }
    }
    return n;
  }

  function findPlace(label) {
    if (!label) { return null; }
    // 「我的位置」不是 places 里的一项，而是定位后生成的一个临时起点
    var raw0 = String(label).replace(/[（(].*?[）)]/g, "").trim();
    if (/^(我的位置|我的所在地|当前位置|我在这里|我这儿|我这|my location|where am i)$/i.test(raw0)) {
      return myPlace || null;
    }
    var raw = normPlace(label);
    if (!raw) { return null; }
    var n = normPlace(expandAlias(raw));

    // 简写补全：实验楼C → 实验楼C区；教学楼C → 教学楼C栋；C区 → 实验楼C区
    if (/^实验楼[a-e]$/.test(n)) { n += "区"; }
    if (/^教学楼[a-g]$/.test(n)) { n += "栋"; }
    if (/^[a-e]区$/.test(n)) { n = "实验楼" + n; }

    // 只报门牌号：13栋 → 南苑13栋；3栋 → 北苑3栋
    var m = n.match(/^(?:宿舍|学生宿舍|南苑|北苑)?(\d{1,2})栋?$/);
    if (m) {
      var num = parseInt(m[1], 10);
      if (num >= 7 && num <= 13) { n = "南苑" + num + "栋"; }
      else if (num >= 1 && num <= 6) { n = "北苑" + num + "栋"; }
    }

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
  window.__navDebug.renderInfo = function () {
    return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  };
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

  setStatus(window.t ? window.t("status.pick") : "请选择起点和终点（可直接点击画面中的建筑）。");
  animate();
})();
