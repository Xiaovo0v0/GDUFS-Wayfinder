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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  sun.shadow.mapSize.set(4096, 4096);
  var sc = sun.shadow.camera;
  var half = Math.max(spanX, spanZ) * 0.78;
  sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
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
      color: col(0x6b7161), side: THREE.DoubleSide
    });
    D.buildings.forEach(function (b) {
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
  D.landscape.forEach(function (l) {
    if (!l.pitch || l.water) return;
    // 田径场是带内环的环状面：外圈跑道 + 内场草地
    if (l.sport === "running" && l.rings.length > 1) {
      scene.add(flatPolygonMesh([l.rings[0]], col(0x9a5f45), 0.22, 1.0));
      scene.add(flatPolygonMesh([l.rings[1]], col(0x4f8a48), 0.26, 1.0));
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
      pts.push([x, z, 0.75 + rand() * 0.6]);
    }

    var trunkGeo = new THREE.CylinderGeometry(0.32, 0.44, 4.2, 5);
    trunkGeo.translate(0, 2.1, 0);
    var crownGeo = new THREE.IcosahedronGeometry(3.1, 0);
    crownGeo.translate(0, 6.4, 0);

    var trunkMat = new THREE.MeshLambertMaterial({ color: col(0x6b5340) });
    var crownMat = new THREE.MeshLambertMaterial({ color: col(0x3f6b3c) });
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
    // 北校区暂时没有 GLB（模型文件是南校专属），直接用程序化体块
    if (CAMPUS === "north") {
      window.__navDebug.mode = "procedural";
      return;
    }
    if (!THREE.GLTFLoader) { return; }
    var loader = new THREE.GLTFLoader();
    loader.load(window.GDUFS_GLB_URL || "assets/gdufs_buildings.glb", function (gltf) {
      var byId = {};
      D.buildings.forEach(function (b) { byId[b.id] = b; });
      var tagged = 0;
      gltf.scene.traverse(function (o) {
        if (!o.isMesh) { return; }
        o.castShadow = true;
        o.receiveShadow = true;
        var tag = (o.name || "") + "|" + (o.parent ? o.parent.name : "");
        var mm = tag.match(/B\d{3}[A-Z]?/);
        var b = mm ? byId[mm[0]] : null;
        if (b) { o.userData.building = b; tagged++; }
        if (o.material && o.material.map) { o.material.map.anisotropy = 4; }
        // B5：屋面偏冷灰，屋顶设备提亮，形成层次
        if (o.material && o.material.name === "roof") {
          o.material.color = new THREE.Color(0x8a9096);
          o.material.roughness = 0.95;
        }
        if (o.material && o.material.name === "metal") {
          o.material.color = new THREE.Color(0xc2c7ca);
          o.material.roughness = 0.8;
        }
      });
      scene.remove(procedural);
      scene.add(gltf.scene);
      addRoofGreenery();
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
    if (startPlace) {
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
    var geoOuter = ribbonGeometry(pts, 5.4, 0.40, 12);
    pathGroup.add(new THREE.Mesh(geoOuter, new THREE.MeshBasicMaterial({
      color: 0xb8430c, side: THREE.DoubleSide, transparent: true, opacity: 0.92
    })));
    var geoInner = ribbonGeometry(pts, 3.4, 0.47, 12);
    pathGroup.add(new THREE.Mesh(geoInner, new THREE.MeshBasicMaterial({
      color: 0xffa02e, side: THREE.DoubleSide
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
        new THREE.SphereGeometry(1.8, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe08a })
      );
      dot.position.set(pts[t][0], 1.6, pts[t][1]);
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
    setStatus(
      '<b>' + _n(startPlace.label) + '</b> → <b>' + _n(endPlace.label) + '</b><br>' +
      (_e
        ? 'Walk about <span class="ok">' + Math.round(res.dist) + ' m</span> · ' + pts.length + ' waypoints' +
          (viaTunnel ? '<br><span class="ok">via the underground tunnel</span>' : '')
        : '沿道路步行约 <span class="ok">' + Math.round(res.dist) + ' 米</span> · 途经 ' + pts.length + ' 个路点' +
          (viaTunnel ? '<br><span class="ok">经地下隧道穿行</span>' : ''))
    );
  }

  // ============================================================
  // 10. 交互
  // ============================================================
  function fillSelect(sel) {
    var html = '<option value="-1">' + (window.t ? window.t("form.select") : "请选择…") + '</option>';
    places.forEach(function (p, i) {
      var lb = window.tName ? window.tName(p.label) : p.label;
      html += '<option value="' + i + '">' + lb + "</option>";
    });
    sel.innerHTML = html;
  }
  var startSel = document.getElementById("startSelect");
  var endSel = document.getElementById("endSelect");
  fillSelect(startSel);
  fillSelect(endSel);

  startSel.addEventListener("change", function () {
    startPlace = places[parseInt(this.value, 10)] || null;
    route();
  });
  endSel.addEventListener("change", function () {
    endPlace = places[parseInt(this.value, 10)] || null;
    route();
  });

  function syncSelects() {
    startSel.value = startPlace ? String(places.indexOf(startPlace)) : "-1";
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
    if (!startPlace || (startPlace && endPlace)) {
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
  // 11. 渲染循环
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
