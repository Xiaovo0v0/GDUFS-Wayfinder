/* 广外大学城校区体育馆（B031）程序化模型
 * 由 gym-demo.html 的体育馆部分抽出，坐标以 B031 平面中心为原点。
 * 地图接入：gym.position.set(104.4, 0, 613.75)，rotation.y = 0，scale 1。
 */
(function () {
  'use strict';
  if (!window.THREE) return;

  var C = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };
  var maxAniso = 8;

  function makeTex(w, h, draw) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    draw(g, w, h);
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = maxAniso;
    return t;
  }

  window.buildGDUFSGym = function () {
    var root = new THREE.Group();
    root.name = 'GDUFS_Gym';

    // ---------------------------------------------------------------- textures
    var glassTex = makeTex(256, 320, function (g, w, h) {
      var grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, '#7aa8b8');
      grd.addColorStop(0.45, '#4a7a8a');
      grd.addColorStop(0.8, '#2a5262');
      grd.addColorStop(1, '#1a3a48');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 7; i++) {
        g.fillStyle = 'rgba(255,235,190,' + (0.06 + Math.random() * 0.08) + ')';
        g.fillRect(10 + Math.random() * 230, 80 + Math.random() * 180, 12 + Math.random() * 22, 16);
      }
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(36, 10, 14, 260);
      g.fillRect(170, 20, 8, 240);
      g.fillStyle = '#e8e8e2';
      g.fillRect(0, 288, w, 32);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 288, w, 4);
      g.fillStyle = '#d8d8d2';
      g.fillRect(0, 0, 6, h); g.fillRect(124, 0, 6, h); g.fillRect(250, 0, 6, h);
    });

    var panelTex = makeTex(256, 320, function (g, w, h) {
      g.fillStyle = '#d8d8d2'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,120,112,0.28)'; g.lineWidth = 1;
      for (var y = 0; y < h; y += 40) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      }
      for (var x = 0; x < w; x += 64) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
      }
      var grd = g.createLinearGradient(0, 236, 0, 300);
      grd.addColorStop(0, '#6a8a98');
      grd.addColorStop(1, '#2a4a58');
      g.fillStyle = grd; g.fillRect(0, 236, w, 64);
      g.fillStyle = '#8a9aa0';
      for (var k = 0; k < w; k += 32) g.fillRect(k, 236, 3, 64);
      g.fillStyle = '#c8c8c0'; g.fillRect(0, 300, w, 8);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 236, w, 4);
    });

    var baseTex = makeTex(256, 256, function (g, w, h) {
      g.fillStyle = '#d6d2c6'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,115,102,0.30)'; g.lineWidth = 1;
      for (var y = 0; y < h; y += 48) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        var off = (y / 48) % 2 ? 32 : 0;
        for (var x = off; x < w; x += 64) {
          g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 48); g.stroke();
        }
      }
      for (var i = 0; i < 1800; i++) {
        g.fillStyle = 'rgba(255,255,255,0.03)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });

    var signTex = makeTex(512, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(10,14,18,0.72)';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#f4f1ea';
      g.font = 'bold 52px "Microsoft YaHei","SimHei",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('体育馆', w * 0.32, h * 0.52);
      g.font = 'bold 30px "Arial",sans-serif';
      g.fillStyle = '#d8b46a';
      g.fillText('GYMNASIUM', w * 0.72, h * 0.52);
      g.strokeStyle = 'rgba(216,180,106,0.7)'; g.lineWidth = 3;
      g.strokeRect(2, 2, w - 4, h - 4);
    });
    signTex.wrapS = signTex.wrapT = THREE.ClampToEdgeWrapping;

    // ---------------------------------------------------------------- materials
    var glassMat = new THREE.MeshStandardMaterial({
      map: glassTex, roughness: 0.18, metalness: 0.35,
      emissive: C(0x0a2028), emissiveIntensity: 0.25, side: THREE.DoubleSide
    });
    var baseMat = new THREE.MeshStandardMaterial({
      map: baseTex, roughness: 0.88, metalness: 0.04, side: THREE.DoubleSide
    });
    var panelMat = new THREE.MeshStandardMaterial({
      map: panelTex, roughness: 0.72, metalness: 0.12, side: THREE.DoubleSide
    });
    var whiteMat = new THREE.MeshStandardMaterial({
      color: C(0xecece6), roughness: 0.5, metalness: 0.18, side: THREE.DoubleSide
    });
    var darkGlassMat = new THREE.MeshStandardMaterial({
      color: C(0x16262c), roughness: 0.18, metalness: 0.45, side: THREE.DoubleSide
    });
    var signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, toneMapped: false });

    // ---------------------------------------------------------------- plan
    var RAW = [
      [106.4, 571.6], [98.9, 571.7], [87.9, 573.9], [77.9, 578.3], [71.9, 582.3],
      [64.6, 589.8], [60.9, 595.5], [57.4, 604.9], [56.5, 611.5], [56.8, 618.1],
      [59.4, 627.8], [62.5, 633.8], [69.1, 641.9], [74.6, 646.5], [84.2, 651.8],
      [91.3, 654.2], [102.4, 655.9], [113.7, 655.2], [120.9, 653.5], [130.9, 649.1],
      [136.9, 645.1], [142, 640.3], [147.9, 631.9], [150.5, 625.7], [152.3, 615.9],
      [151.4, 606], [149.4, 599.6], [146.3, 593.6], [139.7, 585.5], [134.2, 580.9],
      [124.6, 575.6], [117.5, 573.2]
    ];
    var CX = 104.4, CZ = 613.75;
    var RING = RAW.map(function (p) { return [p[0] - CX, p[1] - CZ]; });
    var EAVE = 18, PEAK = 33;

    function wall(x1, z1, x2, z2, y0, y1, mat, mu, mv) {
      var len = Math.hypot(x2 - x1, z2 - z1);
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([
        x1, y0, z1, x2, y0, z2, x2, y1, z2, x1, y1, z1
      ], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([
        0, 0, len / mu, 0, len / mu, (y1 - y0) / mv, 0, (y1 - y0) / mv
      ], 2));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      var m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      root.add(m);
      return m;
    }

    for (var i = 0; i < RING.length; i++) {
      var a = RING[i], b = RING[(i + 1) % RING.length];
      wall(a[0], a[1], b[0], b[1], 0, 6, baseMat, 3.6, 3.0);
      wall(a[0], a[1], b[0], b[1], 6, EAVE, panelMat, 3.6, 4.0);
      wall(a[0], a[1], b[0], b[1], EAVE - 0.5, EAVE + 0.4, whiteMat, 3.6, 1.0);
    }

    // 屋面板（室内顶）
    (function roofDeck() {
      var shape = new THREE.Shape();
      RING.forEach(function (p, idx) {
        if (idx === 0) shape.moveTo(p[0], -p[1]); else shape.lineTo(p[0], -p[1]);
      });
      shape.closePath();
      var geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, EAVE - 0.15, 0);
      var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: C(0xd8d8d2), roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide
      }));
      m.receiveShadow = true;
      root.add(m);
    })();

    // ---------------------------------------------------------------- roof shell
    var upperMat = new THREE.MeshStandardMaterial({
      color: C(0xd8d8d2), roughness: 0.62, metalness: 0.18, side: THREE.DoubleSide
    });

    (function upperShell() {
      var NU = 36, NV = 12, pos = [], uv = [], idx = [];
      var L = 152, W = 96;
      for (var i = 0; i <= NU; i++) {
        var u = -1 + 2 * i / NU;
        var tip = Math.max(0, 1 - u * u);
        var half = Math.max(0.45, (W / 2) * Math.pow(tip, 0.62));
        for (var j = 0; j <= NV; j++) {
          var v = -1 + 2 * j / NV;
          var ridgeV = 0.5;
          var d = Math.abs(v - ridgeV);
          var bump = Math.pow(Math.max(0, 1 - Math.pow(d / 0.5, 2)), 0.8);
          var xAbs = Math.abs(u) * L / 2;
          var tipX = Math.max(0, 1 - Math.pow(xAbs / (L / 2), 2));
          var ridgeY = PEAK * Math.sqrt(tipX);
          var e = Math.min(1, Math.max(0, (xAbs - 48) / (L / 2 - 48)));
          var eaveY = EAVE * (1 - e * e * (3 - 2 * e));
          var y = eaveY + (ridgeY - eaveY) * bump;
          pos.push(u * L / 2, Math.min(PEAK, y), v * half);
          uv.push((u + 1) / 2, (v + 1) / 2);
        }
      }
      for (var i2 = 0; i2 < NU; i2++) {
        for (var j2 = 0; j2 < NV; j2++) {
          var a2 = i2 * (NV + 1) + j2;
          var b2 = a2 + 1;
          var c2 = a2 + NV + 2;
          var d2 = a2 + NV + 1;
          idx.push(a2, b2, c2, a2, c2, d2);
        }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      var m = new THREE.Mesh(geo, upperMat);
      m.castShadow = true; m.receiveShadow = true;
      root.add(m);
    })();

    // ---------------------------------------------------------------- entrance
    var portal = new THREE.Group();
    portal.position.set(47.6, 0, -8);
    portal.rotation.y = -Math.PI / 2;
    root.add(portal);

    var pGlass = new THREE.Mesh(new THREE.BoxGeometry(20, 11, 4), glassMat);
    pGlass.position.set(0, 5.5, -1);
    pGlass.castShadow = true; pGlass.receiveShadow = true;
    portal.add(pGlass);

    [-10.4, 10.4].forEach(function (x) {
      var c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 11.4, 4.4), whiteMat);
      c.position.set(x, 5.7, -1);
      c.castShadow = true;
      portal.add(c);
    });
    var beam = new THREE.Mesh(new THREE.BoxGeometry(21.6, 1.0, 4.4), whiteMat);
    beam.position.set(0, 11.2, -1);
    beam.castShadow = true;
    portal.add(beam);

    var canopy = new THREE.Mesh(new THREE.BoxGeometry(24, 0.45, 5.0), whiteMat);
    canopy.position.set(0, 11.6, -5.0);
    canopy.castShadow = true;
    portal.add(canopy);

    var sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.75), signMat);
    sign.position.set(0, 12.9, -7.55);
    sign.rotation.y = Math.PI;
    portal.add(sign);

    for (var s = 0; s < 4; s++) {
      var top = 0.6 - s * 0.15;
      var step = new THREE.Mesh(new THREE.BoxGeometry(22, top, 1.0), whiteMat);
      step.position.set(0, top / 2, -3.6 - s * 1.0);
      step.castShadow = true; step.receiveShadow = true;
      portal.add(step);
    }

    [-5.2, 0, 5.2].forEach(function (x) {
      var d = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 6.5), darkGlassMat);
      d.position.set(x, 3.25, -3.04);
      portal.add(d);
    });

    if (window.mergeStaticGroup) window.mergeStaticGroup(root);
    return root;
  };
})();
