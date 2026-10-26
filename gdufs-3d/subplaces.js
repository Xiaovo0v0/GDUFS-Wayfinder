// 由 tools/make_subplaces.py 生成，勿手改。
// 八角楼：行政办公楼北侧延伸出去的八边形会议厅，OSM 轮廓里与主楼连成一条闭合线，
// 这里把八边形那一段截出来作为独立建筑，好让标注、搜索、算路都能单独识别它。
window.GDUFS_SUBPLACES = [
 {
  "id": "B004-1",
  "name": "八角楼",
  "type": "culture",
  "levels": 2,
  "height": 22.5,
  "area": 530.4,
  "rings": [
   [
    [
     -249.5,
     -138.8
    ],
    [
     -243.4,
     -130.8
    ],
    [
     -243.4,
     -120.4
    ],
    [
     -238.6,
     -112.2
    ],
    [
     -229,
     -112.2
    ],
    [
     -220.8,
     -117
    ],
    [
     -220.9,
     -127.8
    ],
    [
     -225.6,
     -135.9
    ],
    [
     -235,
     -135.8
    ],
    [
     -238.1,
     -140.3
    ]
   ]
  ],
  "sub": true,
  "parent": "B004",
  "access": [
   -270.4,
   -142.3
  ],
  "node": 140,
  "access_dist": 20.1
 }
];

(function () {
  var subs = window.GDUFS_SUBPLACES || [];
  [window.GDUFS_DATA, window.GDUFS_NORTH].forEach(function (D) {
    if (!D || !D.buildings) return;
    subs.forEach(function (s) {
      if (String(s.id).indexOf("B004") === 0 && D !== window.GDUFS_DATA) return;
      var i, dup = false;
      for (i = 0; i < D.buildings.length; i++) { if (D.buildings[i].id === s.id) dup = true; }
      if (!dup) D.buildings.push(s);
      // 同时补一条可搜索/可算路的「地点」，否则起点终点下拉里找不到它
      if (!D.places) return;
      for (i = 0; i < D.places.length; i++) { if (D.places[i].ref === s.id) return; }
      var ring = s.rings[0], x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      ring.forEach(function (p) {
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
        if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1];
      });
      D.places.push({
        label: s.name,
        x: Math.round((x0 + x1) / 2 * 10) / 10,
        z: Math.round((z0 + z1) / 2 * 10) / 10,
        kind: "building",
        node: s.node,
        ref: s.id
      });
    });
  });
})();
