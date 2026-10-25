/*
 * 广外南校图书馆 · 地标模型（白天外景版）
 * 从 library-demo.html 的 Three.js 场景移植：只保留建筑本身 + 基座/台阶，
 * 不包含天空、地面、广场、树木和 UI。由 app.js 调用并放到 B002 的位置。
 *
 * 用法：var lib = window.buildGDUFSLibrary();  // 返回 THREE.Group
 *       本地坐标：正面朝 -z，主体向 +z，宽约 113 m、深 34 m、高 19.5/27 m。
 */
(function () {
  'use strict';

  function makeTex(w, h, draw) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    draw(g, w, h);
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  }

  window.buildGDUFSLibrary = function () {
    var C = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };

    // ---------------------------------------------------------------- textures
    var beigeTex = makeTex(256, 256, function (g, w, h) {
      g.fillStyle = '#d9c4a4'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 2600; i++) {
        var v = Math.random() > 0.5 ? 255 : 0;
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.022)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.strokeStyle = 'rgba(150,125,95,0.32)'; g.lineWidth = 1;
      for (var y = 0; y < h; y += 64) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        var off = (y / 64) % 2 ? 32 : 0;
        for (var x = off; x < w; x += 64) {
          g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke();
        }
      }
    });

    var glassTex = makeTex(256, 320, function (g, w, h) {
      var grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, '#8ab8c8');
      grd.addColorStop(0.40, '#6a9aaa');
      grd.addColorStop(0.75, '#3a6a7a');
      grd.addColorStop(1, '#2a5262');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 6; i++) {
        g.fillStyle = 'rgba(255,220,160,' + (0.10 + Math.random() * 0.10) + ')';
        g.fillRect(20 + Math.random() * 210, 100 + Math.random() * 150, 14 + Math.random() * 26, 18);
      }
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(40, 20, 18, 230);
      g.fillRect(170, 30, 10, 210);
      g.fillStyle = '#7a8a90';
      g.fillRect(0, 0, 4, h); g.fillRect(125, 0, 4, h); g.fillRect(252, 0, 4, h);
      g.fillStyle = '#e8e8e2'; g.fillRect(0, 272, w, 48);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 272, w, 4);
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, 316, w, 4);
    });

    var finGlassTex = makeTex(256, 320, function (g, w, h) {
      var grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, '#3a6a78');
      grd.addColorStop(0.55, '#244a58');
      grd.addColorStop(1, '#18323e');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 8; i++) {
        g.fillStyle = 'rgba(255,225,170,' + (0.08 + Math.random() * 0.10) + ')';
        g.fillRect(14 + Math.random() * 220, 80 + Math.random() * 160, 16, 20);
      }
      g.fillStyle = '#dfe4e2'; g.fillRect(0, 288, w, 32);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(60, 10, 12, 250);
    });

    var signTex = makeTex(256, 768, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.save();
      g.translate(w, 0); g.scale(-1, 1);
      g.fillStyle = '#c9a24a';
      g.font = 'bold 132px "Microsoft YaHei","SimHei","PMingLiU",serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(60,40,10,.55)'; g.shadowBlur = 10;
      ['圖', '書', '館'].forEach(function (ch, i) { g.fillText(ch, w / 2, 150 + i * 225); });
      g.shadowBlur = 0;
      g.fillStyle = '#a83228'; g.fillRect(w / 2 - 20, 640, 40, 40);
      g.fillStyle = '#f0d8a8'; g.font = 'bold 22px "Microsoft YaHei",sans-serif';
      g.fillText('广外', w / 2, 662);
      g.restore();
    });
    signTex.wrapS = signTex.wrapT = THREE.ClampToEdgeWrapping;

    var accTex = makeTex(64, 64, function (g, w, h) {
      g.fillStyle = '#1f5fa8'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#fff'; g.lineWidth = 4;
      g.beginPath(); g.arc(30, 18, 8, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(30, 26); g.lineTo(30, 42); g.lineTo(44, 48); g.stroke();
      g.beginPath(); g.arc(30, 46, 12, -Math.PI * 0.2, Math.PI * 0.9); g.stroke();
    });
    accTex.wrapS = accTex.wrapT = THREE.ClampToEdgeWrapping;

    // ---------------------------------------------------------------- materials
    var beigeMat = new THREE.MeshStandardMaterial({ map: beigeTex, roughness: 0.92, metalness: 0.02, side: THREE.DoubleSide });
    var glassMat = new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.16, metalness: 0.35, emissive: C(0x0a2028), emissiveIntensity: 0.35, side: THREE.DoubleSide });
    var finGlassMat = new THREE.MeshStandardMaterial({ map: finGlassTex, roughness: 0.28, metalness: 0.3, emissive: C(0x081820), emissiveIntensity: 0.3, side: THREE.DoubleSide });
    var roofMat = new THREE.MeshStandardMaterial({ color: C(0xd2d2cc), roughness: 0.72, metalness: 0.22, side: THREE.DoubleSide });
    var whiteMat = new THREE.MeshStandardMaterial({ color: C(0xecece6), roughness: 0.55, metalness: 0.12, side: THREE.DoubleSide });
    var columnMat = new THREE.MeshStandardMaterial({ color: C(0xc4c8cc), roughness: 0.35, metalness: 0.55, side: THREE.DoubleSide });
    var finMat = new THREE.MeshStandardMaterial({ color: C(0xd8d8d2), roughness: 0.48, metalness: 0.28, side: THREE.DoubleSide });
    var darkGlassMat = new THREE.MeshStandardMaterial({ color: C(0x16262c), roughness: 0.18, metalness: 0.45, side: THREE.DoubleSide });
    var planterMat = new THREE.MeshStandardMaterial({ color: C(0xcbb28e), roughness: 0.9, metalness: 0.02 });
    var stepMat = new THREE.MeshStandardMaterial({ color: C(0xb8ad9a), roughness: 0.9, metalness: 0.02 });
    var metalMat = new THREE.MeshStandardMaterial({ color: C(0xb8bcc0), roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide });
    var goldMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide, toneMapped: false });
    var accMat = new THREE.MeshBasicMaterial({ map: accTex, side: THREE.DoubleSide, toneMapped: false });

    // ---------------------------------------------------------------- groups
    var root = new THREE.Group();
    var building = new THREE.Group();
    building.position.y = 0.45;
    root.add(building);

    function rbox(w, h, d, x, y, z, mat) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      root.add(m);
      return m;
    }

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
      building.add(m);
      return m;
    }

    function bbox(w, h, d, x, y, z, mat) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      building.add(m);
      return m;
    }

    function roofSlab(x1, x2, z1, z2, y, th, mat) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, th, z2 - z1), mat);
      m.position.set((x1 + x2) / 2, y + th / 2, (z1 + z2) / 2);
      m.castShadow = true; m.receiveShadow = true;
      building.add(m);
      return m;
    }

    // 基座 + 台阶（root，不随 building 抬高；building 会在最后镜像 x）
    rbox(114, 0.45, 34, -6.5, 0.225, 17, planterMat);
    for (var si = 0; si < 3; si++) {
      var stop = 0.45 - si * 0.15;
      rbox(32, stop, 1.2, 6, stop / 2, -0.6 - si * 1.2, stepMat);
    }

    // 北侧（access 点）后门，避免路线终点落在光墙上
    var rearDoor = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.6), darkGlassMat);
    rearDoor.position.set(-12.6, 2.25, 34.42);
    root.add(rearDoor);
    rbox(9.0, 0.35, 2.2, -12.6, 4.4, 35.2, whiteMat);

    // ---------------------------------------------------------------- 左 4 层
    wall(-50, 0, -22, 0, 0, 19.5, beigeMat, 3.6, 3.6);
    wall(-50, 0, -50, 34, 0, 19.5, beigeMat, 3.6, 3.6);
    wall(-50, 34, -22, 34, 0, 19.5, beigeMat, 3.6, 3.6);
    wall(-22, 0.8, -22, 34, 0, 19.5, beigeMat, 3.6, 3.6);
    wall(-22, 34, 8, 34, 0, 19.5, beigeMat, 3.6, 3.6);

    var recess = new THREE.Mesh(
      new THREE.PlaneGeometry(8.0, 1.15),
      new THREE.MeshStandardMaterial({ color: C(0x1a2428), roughness: 0.4, metalness: 0.3 })
    );
    recess.position.set(-45.8, 15.6, -0.06);
    building.add(recess);

    var sign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 6.0), goldMat);
    sign.position.set(44.6, 12.05, -0.07);
    root.add(sign);

    var acc = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.65), accMat);
    acc.position.set(49.1, 1.85, -0.06);
    root.add(acc);

    // ---------------------------------------------------------------- 中部玻璃/圆柱
    wall(-22, 0.8, 8, 0.8, 0, 19.5, glassMat, 3.6, 4.5);
    wall(-22, 0, -22, 0.8, 0, 19.5, beigeMat, 3.6, 3.6);
    wall(8, 0, 8, 0.8, 0, 19.5, beigeMat, 3.6, 3.6);
    bbox(30, 0.75, 0.8, -7, 19.15, 0.4, beigeMat);

    bbox(32, 0.35, 3.6, -6, 4.5, -1.0, whiteMat);
    bbox(32, 0.22, 0.25, -6, 4.28, -2.75, whiteMat);

    for (var ci = 0; ci < 4; ci++) {
      var cx = [-18, -11, -4, 3][ci];
      var col = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 19.5, 22), columnMat);
      col.position.set(cx, 9.75, -2.2);
      col.castShadow = true; col.receiveShadow = true;
      building.add(col);
      var base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.32, 22), metalMat);
      base.position.set(cx, 0.16, -2.2);
      building.add(base);
    }

    for (var di = 0; di < 3; di++) {
      var door = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.3), darkGlassMat);
      door.position.set([-9.5, -6, -2.5][di], 1.65, 0.74);
      building.add(door);
    }

    // ---------------------------------------------------------------- 中央石墩
    wall(8, 0, 14, 0, 0, 19.5, beigeMat, 3.6, 3.6);
    wall(8, 0.8, 8, 34, 0, 19.5, beigeMat, 3.6, 3.6);
    wall(14, 0, 14, 32, 0, 19.5, beigeMat, 3.6, 3.6);
    wall(8, 32, 14, 32, 0, 19.5, beigeMat, 3.6, 3.6);
    var slot = new THREE.Mesh(
      new THREE.PlaneGeometry(0.65, 13.5),
      new THREE.MeshStandardMaterial({ color: C(0x1a2428), roughness: 0.35, metalness: 0.3 })
    );
    slot.position.set(11, 10.5, -0.06);
    building.add(slot);

    // ---------------------------------------------------------------- 右 6 层
    wall(14, 0, 58, 0, 0, 4.5, beigeMat, 3.6, 3.6);
    wall(14, 0, 58, 0, 4.5, 27, finGlassMat, 3.6, 4.5);
    wall(14, 0, 14, 34, 19.5, 27, beigeMat, 3.6, 3.6);
    wall(14, 32, 14, 34, 0, 19.5, beigeMat, 3.6, 3.6);
    wall(58, 0, 63, 0, 0, 27, beigeMat, 3.6, 3.6);
    wall(63, 0, 63, 34, 0, 27, beigeMat, 3.6, 3.6);
    wall(14, 34, 63, 34, 0, 27, beigeMat, 3.6, 3.6);

    for (var wi = 0; wi < 4; wi++) {
      var win = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), darkGlassMat);
      win.position.set([18, 26, 42, 50][wi], 1.9, -0.06);
      building.add(win);
    }
    var sideDoor = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 3.0), darkGlassMat);
    sideDoor.position.set(34, 1.5, -0.06);
    building.add(sideDoor);

    // 竖向鳍
    var finXs = [];
    for (var fx = 15; fx <= 57; fx += 0.9) finXs.push(fx);
    var finGeo = new THREE.BoxGeometry(0.22, 22.5, 0.6);
    var fins = new THREE.InstancedMesh(finGeo, finMat, finXs.length);
    var dummy = new THREE.Object3D();
    for (var fi = 0; fi < finXs.length; fi++) {
      dummy.position.set(finXs[fi], 15.75, -0.55);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      fins.setMatrixAt(fi, dummy.matrix);
    }
    fins.castShadow = true;
    fins.receiveShadow = true;
    building.add(fins);
    fins.instanceMatrix.needsUpdate = true;

    for (var bi = 0; bi < 5; bi++) {
      bbox(44, 0.35, 0.3, 36, [4.5, 9, 13.5, 18, 22.5][bi], -0.4, whiteMat);
    }

    // ---------------------------------------------------------------- 屋顶
    roofSlab(-52, 14, -2.5, 35, 19.5, 0.8, roofMat);
    roofSlab(14, 65, -2, 34, 27, 0.8, roofMat);

    bbox(66, 0.9, 0.35, -19, 19.95, -2.5, whiteMat);
    bbox(0.35, 0.9, 37.5, -52, 19.95, 16.25, whiteMat);
    bbox(51, 0.9, 0.35, 39.5, 27.45, -2, whiteMat);
    bbox(0.35, 0.9, 36, 65, 27.45, 16, whiteMat);

    var soffit = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 3.4),
      new THREE.MeshStandardMaterial({ color: C(0xe4e4de), roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide })
    );
    soffit.rotation.x = Math.PI / 2;
    soffit.position.set(-7, 19.45, -0.85);
    building.add(soffit);

    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), metalMat);
    mast.position.set(-38, 21.6, 14);
    building.add(mast);
    bbox(3.2, 0.9, 2.2, -10, 20.0, 16, metalMat);
    bbox(2.4, 0.7, 1.8, 30, 27.5, 14, metalMat);

    // 地图坐标系 x 为镜像（西为正）；这里把建筑体量镜像，
    // 让“左石材/右竖鳍”在原地图的默认南向视角下仍与照片同向。
    building.scale.x = -1;

    // 图书馆内部有负缩放（building.scale.x = -1），合并会翻转绕序，
    // 因此保留原始网格，不做静态合并。
    return root;
  };
})();
