# -*- coding: utf-8 -*-
"""从 35 顶点轮廓里找出八角楼的八边形部分（8 个约 135° 内角）。

用法：python tools/find_octagon_corners.py
"""
import io
import json
import math

s = io.open(r"gdufs-3d/gdufs-data.js", encoding="utf-8").read()
s = s[s.index("{"):].rstrip().rstrip(";")
data = json.loads(s)
b = next(x for x in data["buildings"] if x["id"] == "B004")
ring = b["rings"][0]
n = len(ring)
print("B004", b["name"], "顶点", n, "面积", round(b["area"], 1), "高度", b["height"])

pts = []
for i in range(n):
    p0, p1, p2 = ring[(i - 1) % n], ring[i], ring[(i + 1) % n]
    v1 = (p0[0] - p1[0], p0[1] - p1[1])
    v2 = (p2[0] - p1[0], p2[1] - p1[1])
    l1, l2 = math.hypot(*v1), math.hypot(*v2)
    if l1 < 1e-9 or l2 < 1e-9:
        pts.append((i, ring[i][0], ring[i][1], 180.0, l1, l2))
        continue
    c = max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)))
    a = math.degrees(math.acos(c))
    pts.append((i, ring[i][0], ring[i][1], a, l1, l2))

print("\n所有顶点（序号, x, z, 内角, 前边长, 后边长）:")
for i, x, z, a, l1, l2 in pts:
    mark = " <== 约135°" if 118 <= a <= 152 else ""
    print("  %2d  (%8.2f, %8.2f)  角%6.1f  边 %6.2f / %6.2f%s" % (i, x, z, a, l1, l2, mark))

oct_pts = [p for p in pts if 118 <= p[3] <= 152]
print("\n候选八角顶点 %d 个:" % len(oct_pts))
for p in oct_pts:
    print("  #%2d (%8.2f, %8.2f) 角 %.1f" % (p[0], p[1], p[2], p[3]))

if len(oct_pts) >= 3:
    cx = sum(p[1] for p in oct_pts) / len(oct_pts)
    cy = sum(p[2] for p in oct_pts) / len(oct_pts)
    print("\n八角楼近似中心 (%.2f, %.2f)" % (cx, cy))
    r = sum(math.hypot(p[1] - cx, p[2] - cy) for p in oct_pts) / len(oct_pts)
    print("平均外接半径 %.2f m" % r)
