# -*- coding: utf-8 -*-
"""从行政办公楼轮廓里分离出八角楼，生成 gdufs-3d/subplaces.js。

思路：行政办公楼是「矩形主楼 + 北侧八边形会议厅」，OSM 轮廓把两者合成一条
35 顶点闭合线。八边形的特征是连续若干个 ~120–150° 内角、边长 9–11 m。
把这些顶点截出来单独成环，即可作为独立建筑参与标注、搜索与算路。

用法：python tools/make_subplaces.py
"""
import io
import json
import math

SRC = r"gdufs-3d/gdufs-data.js"
OUT = r"gdufs-3d/subplaces.js"


def load(path):
    s = io.open(path, encoding="utf-8").read()
    s = s[s.index("{"):].rstrip().rstrip(";")
    return json.loads(s)


def interior_angles(ring):
    n = len(ring)
    out = []
    for i in range(n):
        p0, p1, p2 = ring[(i - 1) % n], ring[i], ring[(i + 1) % n]
        v1 = (p0[0] - p1[0], p0[1] - p1[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        if l1 < 1e-9 or l2 < 1e-9:
            out.append(180.0)
            continue
        c = max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)))
        out.append(math.degrees(math.acos(c)))
    return out


def area_of(ring):
    a = 0.0
    for i in range(len(ring)):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % len(ring)]
        a += x0 * y1 - x1 * y0
    return abs(a) / 2.0


def centroid(ring):
    a = 0.0
    cx = cy = 0.0
    for i in range(len(ring)):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % len(ring)]
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    a *= 0.5
    return cx / (6 * a), cy / (6 * a)


data = load(SRC)
b = next(x for x in data["buildings"] if x["id"] == "B004")
ring = b["rings"][0]
ang = interior_angles(ring)
n = len(ring)

# 找最长的一段连续"钝角 + 短边"顶点
best = (0, 0, 0)
start = None
for i in range(n * 2):
    idx = i % n
    edge_after = math.hypot(ring[(idx + 1) % n][0] - ring[idx][0], ring[(idx + 1) % n][1] - ring[idx][1])
    ok = 108 <= ang[idx] <= 162 and edge_after <= 12.5
    if ok and start is None:
        start = i
    if not ok and start is not None:
        if i - start > best[0]:
            best = (i - start, start, i - 1)
        start = None

run_len, s_idx, e_idx = best
print("最长钝角连续段：%d 个顶点（%d..%d）" % (run_len, s_idx % n, e_idx % n))
if run_len < 6:
    raise SystemExit("未找到八边形段，请人工核对")

oct_ring = [ring[i % n] for i in range(s_idx, e_idx + 1)]
cx, cy = centroid(oct_ring)
area = area_of(oct_ring)
rmax = max(math.hypot(p[0] - cx, p[1] - cy) for p in oct_ring)
print("八角楼：中心 (%.2f, %.2f) 面积 %.1f m² 外接半径 %.1f m 顶点 %d" % (cx, cy, area, rmax, len(oct_ring)))
print("原楼 access=%s node=%s" % (b.get("access"), b.get("node")))

entry = {
    "id": "B004-1",
    "name": "八角楼",
    "type": "culture",
    "levels": 2,
    "height": round(b["height"] + 2.5, 1),
    "area": round(area, 1),
    "rings": [[[round(p[0], 2), round(p[1], 2)] for p in oct_ring]],
    "sub": True,
    "parent": "B004",
    "access": b.get("access"),
    "node": b.get("node"),
    "access_dist": b.get("access_dist"),
}

js = """// 由 tools/make_subplaces.py 生成，勿手改。
// 八角楼：行政办公楼北侧延伸出去的八边形会议厅，OSM 轮廓里与主楼连成一条闭合线，
// 这里把八边形那一段截出来作为独立建筑，好让标注、搜索、算路都能单独识别它。
window.GDUFS_SUBPLACES = %s;

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
""" % json.dumps([entry], ensure_ascii=False, indent=1)

io.open(OUT, "w", encoding="utf-8").write(js)
print("已写出", OUT)
