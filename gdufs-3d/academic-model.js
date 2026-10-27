/* 广外大学城校区学术交流中心（B041）程序化模型
 * 由 academic-demo.html 的建筑部分抽出，坐标以 B041 平面中心为原点。
 * 地图接入：academic.position.set(-224.3, 0, -309.25)，rotation.y = 0，scale 1。
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

  window.buildGDUFSAcademic = function () {
    var root = new THREE.Group();
    root.name = 'GDUFS_AcademicCenter';

    // ---------------------------------------------------------------- textures
    var facadeTex = makeTex(256, 256, function (g, w, h) {
      g.fillStyle = '#d98a62'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, w, 40);
      g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, 18);
      g.fillStyle = '#203f49'; g.fillRect(0, 46, w, 104);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 52, w, 8);
      g.fillStyle = 'rgba(236,232,224,0.55)';
      for (var x = 0; x < w; x += 64) g.fillRect(x, 46, 2, 104);
      g.fillRect(0, 148, w, 6);
      g.fillStyle = '#c47a52'; g.fillRect(0, 154, w, h - 154);
      g.strokeStyle = 'rgba(90,50,35,0.18)'; g.lineWidth = 1;
      for (var y = 154; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    });

    var glassTex = makeTex(256, 256, function (g, w, h) {
      g.fillStyle = '#2a4a55'; g.fillRect(0, 0, w, h);
      var grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, 'rgba(120,180,200,0.35)'); grd.addColorStop(1, 'rgba(20,50,60,0.2)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8e4da';
      for (var x = 0; x < w; x += 64) g.fillRect(x, 0, 4, h);
      for (var y = 0; y < h; y += 80) g.fillRect(0, y, w, 3);
    });
    glassTex.repeat.set(2, 2);

    var glassPanel = new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.2, metalness: 0.4, side: THREE.DoubleSide });
    var facadeMat = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide });
    var whiteMat = new THREE.MeshStandardMaterial({ color: C(0xf2efe8), roughness: 0.55, metalness: 0.02, side: THREE.DoubleSide });
    var roofMat = new THREE.MeshStandardMaterial({
      map: window.GDUFS_ROOF_TEX ? window.GDUFS_ROOF_TEX(0.125) : null,
      color: window.GDUFS_ROOF_TEX ? C(0xffffff) : C(0xd8d4c8),
      roughness: 0.9, metalness: 0.03, side: THREE.DoubleSide
    });
    var darkMat = new THREE.MeshStandardMaterial({ color: C(0x4a4a44), roughness: 0.8 });

    // ---------------------------------------------------------------- plan
    var RAW = [
      [-267.4,-336.3],[-267,-316.4],[-280.5,-316.2],[-280.2,-299.7],[-287.9,-299.6],
      [-287.7,-289.4],[-283,-289.5],[-282.6,-268],[-246.4,-268.7],[-246.5,-275.1],
      [-231.1,-275.3],[-231.4,-290.5],[-201.3,-291],[-201.5,-302.5],[-160.7,-303.2],
      [-161.1,-324.6],[-198.5,-323.9],[-198.6,-329.8],[-188.5,-330],[-188.6,-336.1],
      [-185.2,-340.6],[-185.3,-346.5],[-189.4,-350.5],[-196.5,-350.3],[-199.8,-346.9],
      [-230.3,-346.3],[-234.8,-341.7],[-234.7,-336.9],[-267.4,-336.3]
    ];
    var CX = -224.3, CZ = -309.25;
    var RING = RAW.map(function (p) { return [p[0] - CX, p[1] - CZ]; });
    var H = 23, GROUND_H = 4.6;
    var LEVELS = [4.6, 8.0, 11.4, 14.8, 18.2, 21.6, 23];

    function outNormal(x1, z1, x2, z2) {
      var dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz) || 1;
      var nx = dz / len, nz = -dx / len;
      var mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
      return [nx, nz];
    }

    function wall(x1, z1, x2, z2, y0, y1, mat, mu, mv) {
      var len = Math.hypot(x2 - x1, z2 - z1);
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([x1,y0,z1,x2,y0,z2,x2,y1,z2,x1,y1,z1], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,len/mu,0,len/mu,(y1-y0)/mv,0,(y1-y0)/mv], 2));
      geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
      var m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      root.add(m); return m;
    }

    // ---------------------------------------------------------------- facades
    for (var i = 0; i < RING.length - 1; i++) {
      var a = RING[i], b = RING[i + 1];
      wall(a[0], a[1], b[0], b[1], 0, GROUND_H, glassPanel, 6, 4.6);
      wall(a[0], a[1], b[0], b[1], GROUND_H, H, facadeMat, 8.0, 3.4);
      var n = outNormal(a[0], a[1], b[0], b[1]);
      (function (aa, bb, nn) {
        LEVELS.forEach(function (y) {
          if (y > H) return;
          var yy = y - 0.05;
          var geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute([
            aa[0] + nn[0] * 0.10, yy, aa[1] + nn[1] * 0.10,
            bb[0] + nn[0] * 0.10, yy, bb[1] + nn[1] * 0.10,
            bb[0] + nn[0] * 0.10, yy + 0.45, bb[1] + nn[1] * 0.10,
            aa[0] + nn[0] * 0.10, yy + 0.45, aa[1] + nn[1] * 0.10
          ], 3));
          geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
          var band = new THREE.Mesh(geo, whiteMat);
          band.castShadow = true; root.add(band);
        });
      })(a, b, n);
    }

    // 屋顶
    (function roof() {
      var shape = new THREE.Shape();
      RING.forEach(function (p, idx) { if (idx === 0) shape.moveTo(p[0], -p[1]); else shape.lineTo(p[0], -p[1]); });
      shape.closePath();
      var geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2); geo.translate(0, H, 0);
      var m = new THREE.Mesh(geo, roofMat);
      m.receiveShadow = true; root.add(m);
    })();

    // 女儿墙
    for (var pi = 0; pi < RING.length - 1; pi++) {
      var pa = RING[pi], pb = RING[pi + 1];
      wall(pa[0], pa[1], pb[0], pb[1], H, H + 0.9, whiteMat, 4, 0.9);
    }

    // 南侧柱廊 / 白架 / 竖柱
    var southEdges = [];
    for (var si = 0; si < RING.length - 1; si++) {
      var sa = RING[si], sb = RING[si + 1];
      if ((sa[1] + sb[1]) / 2 < -24) southEdges.push([sa, sb]);
    }
    southEdges.forEach(function (e) {
      var a2 = e[0], b2 = e[1];
      var len = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]);
      var n2 = outNormal(a2[0], a2[1], b2[0], b2[1]);
      var count = Math.max(1, Math.round(len / 6));
      for (var c = 1; c < count; c++) {
        var t = c / count;
        var x = a2[0] + (b2[0] - a2[0]) * t + n2[0] * 1.1;
        var z = a2[1] + (b2[1] - a2[1]) * t + n2[1] * 1.1;
        var col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, GROUND_H, 10), whiteMat);
        col.position.set(x, GROUND_H / 2, z); col.castShadow = true; root.add(col);
        var pc = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.0, 8), whiteMat);
        pc.position.set(x, H + 1.0, z); pc.castShadow = true; root.add(pc);
      }
      var beam = new THREE.Mesh(new THREE.BoxGeometry(len + 1.5, 0.42, 0.42), whiteMat);
      var mid = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2];
      beam.position.set(mid[0] + n2[0] * 1.1, H + 2.0, mid[1] + n2[1] * 1.1);
      beam.rotation.y = -Math.atan2(b2[1] - a2[1], b2[0] - a2[0]);
      beam.castShadow = true; root.add(beam);
    });

    southEdges.forEach(function (e) {
      var a3 = e[0], b3 = e[1];
      [0, 0.5].forEach(function (t) {
        var x = a3[0] + (b3[0] - a3[0]) * t;
        var z = a3[1] + (b3[1] - a3[1]) * t;
        var pier = new THREE.Mesh(new THREE.BoxGeometry(0.7, H - GROUND_H, 0.7), whiteMat);
        pier.position.set(x, GROUND_H + (H - GROUND_H) / 2, z);
        pier.castShadow = true; root.add(pier);
      });
    });

    // 西端阳台
    function balconyAt(x, z, nx, nz) {
      var g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = Math.atan2(nx, nz);
      for (var lv = 2; lv <= 5; lv++) {
        var y = LEVELS[lv - 1];
        var slab = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 2.2), whiteMat);
        slab.position.set(0, y, 1.1); slab.castShadow = true; g.add(slab);
        var rail = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 0.08), whiteMat);
        rail.position.set(0, y + 1.05, 2.1); g.add(rail);
        for (var r = -2.4; r <= 2.4; r += 1.2) {
          var post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.05, 0.08), whiteMat);
          post.position.set(r, y + 0.52, 2.1); g.add(post);
        }
      }
      root.add(g);
    }
    var balc = [];
    for (var bi = 0; bi < RING.length - 1; bi++) {
      var ba = RING[bi], bb = RING[bi + 1];
      var bmx = (ba[0] + bb[0]) / 2, bmz = (ba[1] + bb[1]) / 2;
      if (bmz < -24 && bmx > -55 && bmx < -25) {
        var bn = outNormal(ba[0], ba[1], bb[0], bb[1]);
        balc.push([bmx, bmz, bn[0], bn[1]]);
      }
    }
    balc.slice(0, 2).forEach(function (p) { balconyAt(p[0], p[1], p[2], p[3]); });

    // 中部玻璃楼梯间
    (function atrium() {
      var g = new THREE.Mesh(new THREE.BoxGeometry(8, H - GROUND_H, 1.2), glassPanel);
      g.position.set(6, GROUND_H + (H - GROUND_H) / 2, -30.5);
      g.castShadow = true; root.add(g);
      [[0, H + 0.1], [0, GROUND_H - 0.1]].forEach(function (p) {
        var bar = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.3, 1.5), whiteMat);
        bar.position.set(6, p[1], -30.2); root.add(bar);
      });
      [-4.2, 4.2].forEach(function (dx) {
        var bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, H - GROUND_H, 1.5), whiteMat);
        bar.position.set(6 + dx, GROUND_H + (H - GROUND_H) / 2, -30.2); root.add(bar);
      });
    })();

    // 南侧入口
    (function entrance() {
      var e = new THREE.Group(); e.position.set(-28.1, 0, -27.3); root.add(e);
      var glass = new THREE.Mesh(new THREE.BoxGeometry(18, GROUND_H, 1.2), glassPanel);
      glass.position.set(0, GROUND_H / 2, 0.6); e.add(glass);
      var canopy = new THREE.Mesh(new THREE.BoxGeometry(20, 0.35, 4.0), whiteMat);
      canopy.position.set(0, GROUND_H + 0.3, -1.2); canopy.castShadow = true; e.add(canopy);
      for (var i = -9; i <= 9; i += 6) {
        var col = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, GROUND_H, 8), whiteMat);
        col.position.set(i, GROUND_H / 2, 0.0); e.add(col);
      }
      for (var s = 0; s < 3; s++) {
        var step = new THREE.Mesh(new THREE.BoxGeometry(20, 0.18, 1.0), whiteMat);
        step.position.set(0, 0.09 + s * 0.18, -2.5 - s * 1.0); e.add(step);
      }
    })();

    // 屋顶设备
    [[-40, -8], [-20, 6], [10, -6], [35, 4]].forEach(function (p) {
      var ac = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 2.2), darkMat);
      ac.position.set(p[0], H + 0.55, p[1]);
      ac.castShadow = true; root.add(ac);
    });

    // 西段屋顶白架
    for (var px = -56; px <= -22; px += 7) {
      var pbeam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 26), whiteMat);
      pbeam.position.set(px, H + 2.2, -22);
      pbeam.castShadow = true; root.add(pbeam);
    }
    var pedge = new THREE.Mesh(new THREE.BoxGeometry(36, 0.35, 0.35), whiteMat);
    pedge.position.set(-39, H + 2.2, -35); root.add(pedge);

    if (window.mergeStaticGroup) window.mergeStaticGroup(root);
    return root;
  };
})();
