/* 广外大学城校区南苑 / 北苑学生宿舍参数化模型
 * 7 层 22.4 m，橙白立面 + 长边连续阳台 + 空调 + 楼梯间 + 入口雨棚。
 * 用法：buildGDUFSDorm(b)，b 为 gdufs-data.js 里的宿舍对象。
 */
(function () {
  'use strict';
  if (!window.THREE) return;

  var C = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };
  var maxAniso = 8;
  var shared = {};

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

  // 三套宿舍立面：赭石 / 米砂 / 灰蓝。51 栋宿舍楼如果共用一张贴图，
  // 远看就是一排复制品，所以按楼栋 id 哈希各取一套
  var VARIANTS = [
    { wall: '#d98a62', skirt: '#c47a52', band: '#f2efe8' },
    { wall: '#e0d5b8', skirt: '#c9bd9c', band: '#f7f4ec' },
    { wall: '#c8d1d6', skirt: '#adb8be', band: '#f2f4f5' }
  ];

  function makeFacadeTex(colors) {
    return makeTex(256, 256, function (g, w, h) {
      g.fillStyle = colors.wall; g.fillRect(0, 0, w, h);
      g.fillStyle = colors.band; g.fillRect(0, 0, w, 22);
      // 单间窗
      g.fillStyle = '#203f49'; g.fillRect(46, 58, 164, 118);
      g.fillStyle = '#e8e4da'; g.fillRect(46, 58, 6, 118); g.fillRect(204, 58, 6, 118);
      g.fillRect(46, 58, 164, 6); g.fillRect(46, 170, 164, 6);
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(56, 66, 60, 44);
      // 窗下墙裙
      g.fillStyle = colors.skirt; g.fillRect(0, 22, w, 36); g.fillRect(0, 176, w, h - 176);
      g.fillStyle = 'rgba(80,45,30,0.15)';
      for (var x = 0; x < w; x += 64) g.fillRect(x, 22, 2, h - 22);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 22, w, 3);
    });
  }

  function getMaterials(v) {
    var idx = ((v | 0) % VARIANTS.length + VARIANTS.length) % VARIANTS.length;
    if (shared[idx]) return shared[idx];
    var glassTex = makeTex(256, 256, function (g, w, h) {
      g.fillStyle = '#2a4a55'; g.fillRect(0, 0, w, h);
      var grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, 'rgba(120,180,200,0.35)'); grd.addColorStop(1, 'rgba(20,50,60,0.2)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8e4da';
      for (var x = 0; x < w; x += 64) g.fillRect(x, 0, 4, h);
      for (var y = 0; y < h; y += 80) g.fillRect(0, y, w, 3);
    });
    var facadeTex = makeFacadeTex(VARIANTS[idx]);
    // 屋面碎石贴图：纯色车顶一样的高亮平面最容易露怯，给它一点颗粒
    var roofTex = makeTex(256, 256, function (g, w, h) {
      g.fillStyle = '#6e7275'; g.fillRect(0, 0, w, h);
      for (var gx = 0; gx < w; gx += 32) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(gx, 0, 2, h); }
      for (var gy = 0; gy < h; gy += 32) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, gy, w, 2); }
      for (var k = 0; k < 260; k++) {
        var bx = (k * 37) % w, by = (k * 71) % h, bs = 4 + (k % 3) * 4;
        var v = 96 + ((k * 13) % 24);
        g.fillStyle = 'rgb(' + v + ',' + (v + 2) + ',' + (v + 4) + ')';
        g.fillRect(bx, by, bs, bs);
      }
    });
    shared[idx] = {
      white: new THREE.MeshStandardMaterial({ color: C(0xf2efe8), roughness: 0.55, metalness: 0.02, side: THREE.DoubleSide }),
      roof: new THREE.MeshStandardMaterial({ map: roofTex, color: C(0xffffff), roughness: 0.94, metalness: 0.02, side: THREE.DoubleSide }),
      facade: new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.8, metalness: 0.02, side: THREE.DoubleSide }),
      glass: new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.2, metalness: 0.4, side: THREE.DoubleSide }),
      dark: new THREE.MeshStandardMaterial({ color: C(0x4a4a44), roughness: 0.8 }),
      ac: new THREE.MeshStandardMaterial({ color: C(0xd6d4cc), roughness: 0.7, metalness: 0.1 })
    };
    return shared[idx];
  }

  window.buildGDUFSDorm = function (b) {
    var seed = 0;
    if (b && b.id) for (var si = 0; si < b.id.length; si++) seed = (seed * 131 + b.id.charCodeAt(si)) & 0xFFFF;
    var M = getMaterials(seed % VARIANTS.length);
    var root = new THREE.Group();
    root.name = 'GDUFS_Dorm_' + b.id;
    if (!b || !b.rings || !b.rings[0] || b.rings[0].length < 3) return root;

    var ring = b.rings[0].map(function (p) { return [p[0], p[1]]; });
    var H = b.height || 22.4;
    var GROUND_H = 3.2;
    // 层数按官方 data 走，而不是写死 7 层；层高均分到 H
    var nLevels = b.levels && b.levels > 1
      ? b.levels
      : Math.max(3, Math.round((H - GROUND_H) / 3.2) + 1);
    var LEVELS = [];
    for (var li = 0; li < nLevels; li++) {
      LEVELS.push(GROUND_H + (H - GROUND_H) * (li / (nLevels - 1)));
    }

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

    for (var i = 0; i < ring.length - 1; i++) {
      var a = ring[i], bb = ring[i + 1];
      wall(a[0], a[1], bb[0], bb[1], 0, GROUND_H, M.glass, 6, 3.2);
      wall(a[0], a[1], bb[0], bb[1], GROUND_H, H, M.facade, 4.0, 3.2);
      var n = outNormal(a[0], a[1], bb[0], bb[1]);
      (function (aa, b2, nn) {
        LEVELS.forEach(function (y) {
          if (y > H) return;
          var yy = y - 0.04;
          var geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute([
            aa[0] + nn[0]*0.09, yy, aa[1] + nn[1]*0.09,
            b2[0] + nn[0]*0.09, yy, b2[1] + nn[1]*0.09,
            b2[0] + nn[0]*0.09, yy+0.38, b2[1] + nn[1]*0.09,
            aa[0] + nn[0]*0.09, yy+0.38, aa[1] + nn[1]*0.09
          ], 3));
          geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
          var band = new THREE.Mesh(geo, M.white);
          band.castShadow = true; root.add(band);
        });
      })(a, bb, n);
    }

    var shape = new THREE.Shape();
    ring.forEach(function (p, idx) { if (idx === 0) shape.moveTo(p[0], -p[1]); else shape.lineTo(p[0], -p[1]); });
    shape.closePath();
    var rgeo = new THREE.ShapeGeometry(shape); rgeo.rotateX(-Math.PI / 2); rgeo.translate(0, H, 0);
    var rm = new THREE.Mesh(rgeo, M.roof); rm.receiveShadow = true; root.add(rm);

    for (var pi = 0; pi < ring.length - 1; pi++) {
      wall(ring[pi][0], ring[pi][1], ring[pi+1][0], ring[pi+1][1], H, H + 0.7, M.white, 4, 0.7);
    }

    // 最长边中离 access 最近的一条：连续阳台（南侧/入口侧）
    var maxLen = 0;
    for (var mi = 0; mi < ring.length - 1; mi++) {
      var m1 = ring[mi], m2 = ring[mi + 1];
      var ml = Math.hypot(m2[0] - m1[0], m2[1] - m1[1]);
      if (ml > maxLen) maxLen = ml;
    }
    var longA = null, longB = null, longLen = 0, bestD = Infinity;
    var acc0 = b.access || null;
    for (var ei = 0; ei < ring.length - 1; ei++) {
      var e1 = ring[ei], e2 = ring[ei + 1];
      var l = Math.hypot(e2[0] - e1[0], e2[1] - e1[1]);
      if (l < maxLen * 0.7) continue;
      var emx = (e1[0] + e2[0]) / 2, emz = (e1[1] + e2[1]) / 2;
      var ed = acc0 ? Math.hypot(emx - acc0[0], emz - acc0[1]) : emz;
      if (ed < bestD) { bestD = ed; longA = e1; longB = e2; longLen = l; }
    }
    if (longA) {
      var bn = outNormal(longA[0], longA[1], longB[0], longB[1]);
      var bay = 4.0;
      var count = Math.max(2, Math.floor(longLen / bay));
      for (var fl = 1; fl < LEVELS.length; fl++) {
        var y = LEVELS[fl];
        if (y > H - 0.1) continue;
        for (var c = 0; c < count; c++) {
          var t = (c + 0.5) / count;
          var x = longA[0] + (longB[0] - longA[0]) * t + bn[0] * 1.15;
          var z = longA[1] + (longB[1] - longA[1]) * t + bn[1] * 1.15;
          var slab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 2.2), M.white);
          slab.position.set(x, y, z);
          slab.rotation.y = -Math.atan2(longB[1] - longA[1], longB[0] - longA[0]);
          slab.castShadow = true; root.add(slab);
          var rail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.06), M.white);
          rail.position.set(x + bn[0] * 1.05, y + 0.95, z + bn[1] * 1.05);
          rail.rotation.y = slab.rotation.y; root.add(rail);
          if (c % 2 === 0) {
            var ac = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.5), M.ac);
            ac.position.set(x - bn[0] * 0.4, y + 0.4, z - bn[1] * 0.4);
            ac.rotation.y = slab.rotation.y; root.add(ac);
          }
        }
      }
    }

    // 楼梯间：靠近 access 的角
    var acc = b.access || null;
    var best = ring[0], bd = Infinity;
    ring.slice(0, -1).forEach(function (p) {
      var d = acc ? Math.hypot(p[0] - acc[0], p[1] - acc[1]) : Math.hypot(p[0], p[1]);
      if (d < bd) { bd = d; best = p; }
    });
    var core = new THREE.Mesh(new THREE.BoxGeometry(4.0, H, 3.0), M.glass);
    core.position.set(best[0], H / 2, best[1] - 1.8);
    core.castShadow = true; root.add(core);
    [[0, H + 0.05], [0, 0.1]].forEach(function (q) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.28, 3.4), M.white);
      bar.position.set(best[0], q[1], best[1] - 1.8); root.add(bar);
    });
    [-2.1, 2.1].forEach(function (dx) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.26, H, 3.4), M.white);
      bar.position.set(best[0] + dx, H / 2, best[1] - 1.8); root.add(bar);
    });

    // 入口雨棚：靠近 access 的边
    if (acc) {
      var be = null, bde = Infinity;
      for (var si = 0; si < ring.length - 1; si++) {
        var s1 = ring[si], s2 = ring[si + 1];
        var mx = (s1[0] + s2[0]) / 2, mz = (s1[1] + s2[1]) / 2;
        var d2 = Math.hypot(mx - acc[0], mz - acc[1]);
        if (d2 < bde) { bde = d2; be = [s1, s2]; }
      }
      if (be) {
        var m1 = be[0], m2 = be[1];
        var cx = (m1[0] + m2[0]) / 2, cz = (m1[1] + m2[1]) / 2;
        var nn2 = outNormal(m1[0], m1[1], m2[0], m2[1]);
        var canopy = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.35, 3.2), M.white);
        canopy.position.set(cx + nn2[0] * 1.3, GROUND_H + 0.3, cz + nn2[1] * 1.3);
        canopy.rotation.y = -Math.atan2(m2[1] - m1[1], m2[0] - m1[0]);
        canopy.castShadow = true; root.add(canopy);
        var door = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 2.9), M.glass);
        door.position.set(cx + nn2[0] * 0.12, 1.45, cz + nn2[1] * 0.12);
        door.rotation.y = -Math.atan2(m2[1] - m1[1], m2[0] - m1[0]);
        root.add(door);
      }
    }

    // 屋顶水箱/设备
    var cxs = 0, czs = 0;
    ring.slice(0, -1).forEach(function (p) { cxs += p[0]; czs += p[1]; });
    cxs /= (ring.length - 1); czs /= (ring.length - 1);
    [[-4, 2], [4, -2]].forEach(function (o) {
      var tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.0, 10), M.white);
      tank.position.set(cxs + o[0], H + 1.0, czs + o[1]);
      tank.castShadow = true; root.add(tank);
    });

    if (window.mergeStaticGroup) window.mergeStaticGroup(root);
    return root;
  };
})();
