/* 广外大学城校区实验楼（B045A-E）程序化模型
 * 由 lab-demo.html 的建筑部分抽出，坐标以实验楼群中心为原点。
 * 地图接入：lab.position.set(-193.25, 0, 112.2)，rotation.y = 0，scale 1。
 * 五个区各自带 userData.buildingId，供 app.js 分别挂到 B045A-E。
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

  window.buildGDUFSLab = function () {
    var root = new THREE.Group();
    root.name = 'GDUFS_Lab';

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

    var clockTex = makeTex(256, 256, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#f6f2e8'; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3a3a34'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 114, 0, Math.PI * 2); g.stroke();
      for (var i = 0; i < 12; i++) {
        var a = i * Math.PI / 6;
        g.strokeStyle = '#2a2a24'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
        g.lineTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108); g.stroke();
      }
      g.strokeStyle = '#1a1a16'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(-Math.PI / 3) * 60, 128 + Math.sin(-Math.PI / 3) * 60); g.stroke();
      g.lineWidth = 6;
      g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(Math.PI / 6) * 84, 128 + Math.sin(Math.PI / 6) * 84); g.stroke();
      g.fillStyle = '#1a1a16'; g.beginPath(); g.arc(128, 128, 8, 0, Math.PI * 2); g.fill();
    });

    // ---------------------------------------------------------------- materials
    var whiteMat = new THREE.MeshStandardMaterial({ color: C(0xf2efe8), roughness: 0.55, metalness: 0.02, side: THREE.DoubleSide });
    var roofMat = new THREE.MeshStandardMaterial({
      map: window.GDUFS_ROOF_TEX ? window.GDUFS_ROOF_TEX(0.125) : null,
      color: window.GDUFS_ROOF_TEX ? C(0xffffff) : C(0xd8d4c8),
      roughness: 0.9, metalness: 0.03, side: THREE.DoubleSide
    });
    var facadeMat = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide });
    var glassPanel = new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.2, metalness: 0.4, side: THREE.DoubleSide });
    var clockMat = new THREE.MeshBasicMaterial({ map: clockTex, transparent: true, side: THREE.DoubleSide });

    // ---------------------------------------------------------------- plan
    var ZONES = [
      { id: 'B045A', ring: [[-278.1,80.3],[-273.2,80.2],[-260.5,67.2],[-272.1,67.5],[-272.8,41.7],[-234.7,40.7],[-222.7,28.3],[-230.6,18.5],[-243.3,28.7],[-299,30.2],[-298.6,42.5],[-289.9,42.2],[-289.2,67.9],[-278.4,67.6],[-278.1,80.3]] },
      { id: 'B045B', ring: [[-273.2,80.2],[-266.5,80],[-265.9,104.9],[-260.9,104.7],[-260.4,121.2],[-238,120.6],[-221.5,103.7],[-247.7,104.4],[-248.4,79.5],[-203.1,78.3],[-200.2,81.8],[-188.9,70.1],[-222.7,28.3],[-234.7,40.7],[-233.6,40.7],[-213.1,65.9],[-260.5,67.2],[-273.2,80.2]] },
      { id: 'B045C', ring: [[-231.9,120.4],[-232,117.2],[-173.3,115],[-166.4,123.5],[-155.1,112],[-188.9,70.1],[-200.2,81.8],[-183.3,102.6],[-221.5,103.7],[-238,120.6],[-231.9,120.4]] },
      { id: 'B045D', ring: [[-166.4,123.5],[-145.9,148.7],[-192.1,149.9],[-205.8,164.1],[-200.1,163.9],[-199.5,189.1],[-194.2,189],[-193.9,201.3],[-166.9,200.6],[-154.6,188],[-181.3,188.7],[-181.9,163.4],[-134.9,162.3],[-132.5,165.3],[-121.3,153.8],[-155.1,112],[-166.4,123.5]] },
      { id: 'B045E', ring: [[-166.9,200.6],[-105,199.1],[-99.5,205.9],[-87.5,195.6],[-121.3,153.8],[-132.5,165.3],[-114.9,186.9],[-154.6,188],[-166.9,200.6]] }
    ];
    var CX = -193.25, CZ = 112.2;
    var H = 20, GROUND_H = 4.2;
    var LEVELS = [4.2, 7.8, 11.4, 15.0, 18.6, 20];

    function outNormal(x1, z1, x2, z2) {
      var dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz) || 1;
      var nx = dz / len, nz = -dx / len;
      var mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
      return [nx, nz];
    }

    function wall(parent, x1, z1, x2, z2, y0, y1, mat, mu, mv) {
      var len = Math.hypot(x2 - x1, z2 - z1);
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([x1,y0,z1,x2,y0,z2,x2,y1,z2,x1,y1,z1], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,len/mu,0,len/mu,(y1-y0)/mv,0,(y1-y0)/mv], 2));
      geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
      var m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m); return m;
    }

    ZONES.forEach(function (z) {
      var wing = new THREE.Group();
      wing.userData.buildingId = z.id;
      root.add(wing);

      var ring = z.ring.map(function (p) { return [p[0] - CX, p[1] - CZ]; });
      for (var i = 0; i < ring.length - 1; i++) {
        var a = ring[i], b = ring[i + 1];
        wall(wing, a[0], a[1], b[0], b[1], 0, GROUND_H, glassPanel, 6, 4.2);
        wall(wing, a[0], a[1], b[0], b[1], GROUND_H, H, facadeMat, 8.0, 3.4);
        var n = outNormal(a[0], a[1], b[0], b[1]);
        (function (aa, bb, nn) {
          LEVELS.forEach(function (y) {
            if (y > H) return;
            var yy = y - 0.05;
            var geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute([
              aa[0] + nn[0]*0.10, yy, aa[1] + nn[1]*0.10,
              bb[0] + nn[0]*0.10, yy, bb[1] + nn[1]*0.10,
              bb[0] + nn[0]*0.10, yy+0.42, bb[1] + nn[1]*0.10,
              aa[0] + nn[0]*0.10, yy+0.42, aa[1] + nn[1]*0.10
            ], 3));
            geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
            var band = new THREE.Mesh(geo, whiteMat);
            band.castShadow = true; wing.add(band);
          });
        })(a, b, n);
      }

      var shape = new THREE.Shape();
      ring.forEach(function (p, idx) { if (idx === 0) shape.moveTo(p[0], -p[1]); else shape.lineTo(p[0], -p[1]); });
      shape.closePath();
      var rgeo = new THREE.ShapeGeometry(shape); rgeo.rotateX(-Math.PI / 2); rgeo.translate(0, H, 0);
      var rm = new THREE.Mesh(rgeo, roofMat); rm.receiveShadow = true; wing.add(rm);

      for (var pi = 0; pi < ring.length - 1; pi++) {
        wall(wing, ring[pi][0], ring[pi][1], ring[pi+1][0], ring[pi+1][1], H, H + 0.8, whiteMat, 4, 0.8);
      }

      var best = null, bd = Infinity;
      ring.forEach(function (p) {
        var d = Math.hypot(p[0], p[1]);
        if (d < bd) { bd = d; best = p; }
      });
      if (best) {
        var sg = new THREE.Mesh(new THREE.BoxGeometry(4.2, H, 3.0), glassPanel);
        sg.position.set(best[0], H / 2, best[1] - 2.2);
        sg.castShadow = true; wing.add(sg);
        [[0, H + 0.05], [0, 0.1]].forEach(function (q) {
          var bar = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, 3.4), whiteMat);
          bar.position.set(best[0], q[1], best[1] - 2.2); wing.add(bar);
        });
        [-2.2, 2.2].forEach(function (dx) {
          var bar = new THREE.Mesh(new THREE.BoxGeometry(0.28, H, 3.4), whiteMat);
          bar.position.set(best[0] + dx, H / 2, best[1] - 2.2); wing.add(bar);
        });
      }
      if (window.mergeStaticGroup) window.mergeStaticGroup(wing);
    });

    return root;
  };
})();
