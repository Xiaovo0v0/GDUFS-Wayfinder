/* 静态模型合并：把同一材质的小网格合并成一个 BufferGeometry，
 * 大幅减少 draw call；模型都是静态的，合并不影响点选/材质。
 * 用法：mergeStaticGroup(group)
 */
(function () {
  'use strict';
  if (!window.THREE) return;

  function mergeGeos(geos) {
    var pos = [], norm = [], uv = [], idx = [], offset = 0;
    geos.forEach(function (g) {
      var p = g.getAttribute('position');
      var n = g.getAttribute('normal');
      var u = g.getAttribute('uv');
      var count = p.count;
      for (var i = 0; i < count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        if (n) norm.push(n.getX(i), n.getY(i), n.getZ(i));
        else norm.push(0, 1, 0);
        if (u) uv.push(u.getX(i), u.getY(i));
        else uv.push(0, 0);
      }
      var ix = g.getIndex();
      if (ix) {
        for (var j = 0; j < ix.count; j++) idx.push(ix.getX(j) + offset);
      } else {
        for (var k = 0; k < count; k++) idx.push(k + offset);
      }
      offset += count;
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    out.setIndex(idx);
    out.computeBoundingSphere();
    out.computeBoundingBox();
    return out;
  }

  window.mergeStaticGroup = function (group) {
    if (!group) return group;
    group.updateMatrixWorld(true);
    var bucket = {};
    var remove = [];
    group.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      if (o.userData && o.userData.noMerge) return;
      var mat = o.material;
      if (!mat || Array.isArray(mat)) return;
      var key = mat.uuid;
      if (!bucket[key]) bucket[key] = { mat: mat, geos: [] };
      var g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      if (!g.getAttribute('uv')) {
        var n = g.getAttribute('position').count;
        g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
      }
      bucket[key].geos.push(g);
      remove.push(o);
    });
    remove.forEach(function (o) { if (o.parent) o.parent.remove(o); });
    Object.keys(bucket).forEach(function (key) {
      var b = bucket[key];
      if (!b.geos.length) return;
      var geo = mergeGeos(b.geos);
      var m = new THREE.Mesh(geo, b.mat);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      b.geos.forEach(function (g) { g.dispose(); });
    });
    return group;
  };
})();
