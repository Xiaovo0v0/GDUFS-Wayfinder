/* 广外大学城校区教学楼（A-G）参数化模型
 * 用 lab-model.js 的橙白风格：橙色墙 + 白色水平带 + 玻璃底层 +
 * 玻璃楼梯间 + 白色女儿墙；不含钟楼/屋顶白架。
 * 用法：buildGDUFSTeaching(b)，b 为 gdufs-data.js 里的教学楼对象，
 * 返回的 group 已按 b.rings 的绝对坐标建好，直接 scene.add 即可。
 */
(function () {
  'use strict';
  if (!window.THREE) return;

  var C = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };
  var maxAniso = 8;
  var shared = null;

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

  function getMaterials() {
    if (shared) return shared;
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
    shared = {
      white: new THREE.MeshStandardMaterial({ color: C(0xf2efe8), roughness: 0.55, metalness: 0.02, side: THREE.DoubleSide }),
      roof: new THREE.MeshStandardMaterial({ color: C(0xd8d4c8), roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
      facade: new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide }),
      glass: new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.2, metalness: 0.4, side: THREE.DoubleSide }),
      dark: new THREE.MeshStandardMaterial({ color: C(0x4a4a44), roughness: 0.8 })
    };
    return shared;
  }

  window.buildGDUFSTeaching = function (b) {
    var M = getMaterials();
    var root = new THREE.Group();
    root.name = 'GDUFS_Teaching_' + b.id;
    if (!b || !b.rings || !b.rings[0] || b.rings[0].length < 3) return root;

    var ring = b.rings[0].map(function (p) { return [p[0], p[1]]; });
    var H = b.height || 20;
    var GROUND_H = 4.2;
    var LEVELS = [4.2, 7.8, 11.4, 15.0, 18.6, 20];

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
      wall(a[0], a[1], bb[0], bb[1], 0, GROUND_H, M.glass, 6, 4.2);
      wall(a[0], a[1], bb[0], bb[1], GROUND_H, H, M.facade, 8.0, 3.4);
      var n = outNormal(a[0], a[1], bb[0], bb[1]);
      (function (aa, b2, nn) {
        LEVELS.forEach(function (y) {
          if (y > H) return;
          var yy = y - 0.05;
          var geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute([
            aa[0] + nn[0]*0.10, yy, aa[1] + nn[1]*0.10,
            b2[0] + nn[0]*0.10, yy, b2[1] + nn[1]*0.10,
            b2[0] + nn[0]*0.10, yy+0.42, b2[1] + nn[1]*0.10,
            aa[0] + nn[0]*0.10, yy+0.42, aa[1] + nn[1]*0.10
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
      wall(ring[pi][0], ring[pi][1], ring[pi+1][0], ring[pi+1][1], H, H + 0.8, M.white, 4, 0.8);
    }

    // 玻璃楼梯间：放在离 access 最近的角
    var acc = b.access || null;
    var best = ring[0], bd = Infinity;
    ring.slice(0, -1).forEach(function (p) {
      var d = acc ? Math.hypot(p[0] - acc[0], p[1] - acc[1]) : Math.hypot(p[0], p[1]);
      if (d < bd) { bd = d; best = p; }
    });
    var sg = new THREE.Mesh(new THREE.BoxGeometry(4.0, H, 3.0), M.glass);
    sg.position.set(best[0], H / 2, best[1] - 2.0);
    sg.castShadow = true; root.add(sg);
    [[0, H + 0.05], [0, 0.1]].forEach(function (q) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 3.4), M.white);
      bar.position.set(best[0], q[1], best[1] - 2.0); root.add(bar);
    });
    [-2.1, 2.1].forEach(function (dx) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.26, H, 3.4), M.white);
      bar.position.set(best[0] + dx, H / 2, best[1] - 2.0); root.add(bar);
    });

    // 入口雨棚：放在离 access 最近的边上
    if (acc) {
      var bestE = null, bdE = Infinity;
      for (var ei = 0; ei < ring.length - 1; ei++) {
        var e1 = ring[ei], e2 = ring[ei + 1];
        var mx = (e1[0] + e2[0]) / 2, mz = (e1[1] + e2[1]) / 2;
        var d = Math.hypot(mx - acc[0], mz - acc[1]);
        if (d < bdE) { bdE = d; bestE = [e1, e2]; }
      }
      if (bestE) {
        var m1 = bestE[0], m2 = bestE[1];
        var cx = (m1[0] + m2[0]) / 2, cz = (m1[1] + m2[1]) / 2;
        var nn2 = outNormal(m1[0], m1[1], m2[0], m2[1]);
        var canopy = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.38, 3.4), M.white);
        canopy.position.set(cx + nn2[0] * 1.4, GROUND_H + 0.35, cz + nn2[1] * 1.4);
        canopy.rotation.y = -Math.atan2(m2[1] - m1[1], m2[0] - m1[0]);
        canopy.castShadow = true; root.add(canopy);
        var door = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 3.8), M.glass);
        door.position.set(cx + nn2[0] * 0.12, 1.9, cz + nn2[1] * 0.12);
        door.rotation.y = -Math.atan2(m2[1] - m1[1], m2[0] - m1[0]);
        root.add(door);
      }
    }

    // 屋顶设备
    var cxs = 0, czs = 0;
    ring.slice(0, -1).forEach(function (p) { cxs += p[0]; czs += p[1]; });
    cxs /= (ring.length - 1); czs /= (ring.length - 1);
    [[-4, -2], [4, 2]].forEach(function (o) {
      var ac = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 2.0), M.dark);
      ac.position.set(cxs + o[0], H + 0.5, czs + o[1]);
      ac.castShadow = true; root.add(ac);
    });

    if (window.mergeStaticGroup) window.mergeStaticGroup(root);
    return root;
  };
})();
