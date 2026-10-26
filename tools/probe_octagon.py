# -*- coding: utf-8 -*-
"""侦察：行政办公楼周边轮廓，寻找八角楼（八边形）几何。

用法：python tools/probe_octagon.py
"""
import io
import json
import math


def load(path):
    s = io.open(path, encoding="utf-8").read()
    s = s[s.index("{"):].rstrip().rstrip(";")
    return json.loads(s)


data = load(r"gdufs-3d/gdufs-data.js")
buildings = data["buildings"]
meta = data.get("meta", {})
print("meta keys:", list(meta.keys()))
print("origin:", meta.get("origin_utm"), "scale:", meta.get("scale"), "px_per_m:", meta.get("px_per_m"))


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
    if abs(a) < 1e-9:
        n = len(ring)
        return sum(p[0] for p in ring) / n, sum(p[1] for p in ring) / n, 0.0
    return cx / (6 * a), cy / (6 * a), abs(a)


# 找行政办公楼
admin = next(b for b in buildings if "行政办公楼" in b["name"])
ax, ay, _ = centroid(admin["rings"][0])
print("\n行政办公楼 B004 质心 (%.1f, %.1f) 面积 %.1f 顶点 %d" % (ax, ay, admin["area"], len(admin["rings"][0])))

print("\n=== 100 米内的建筑 ===")
for b in buildings:
    bx, by, _ = centroid(b["rings"][0])
    d = math.hypot(bx - ax, by - ay)
    if d < 100:
        vc = [len(r) for r in b["rings"]]
        print("  %-6s %-22s 距离 %5.1f m  面积 %7.1f  高度 %4.1f  环顶点 %s" %
              (b["id"], b["name"][:20], d, b["area"], b["height"], vc))

print("\n=== 全库：接近正八边形的轮廓（8 或 9 顶点、且面积/外接圆面积比 0.7~0.95）===")
for b in buildings:
    for ri, ring in enumerate(b["rings"]):
        if not (7 <= len(ring) <= 12):
            continue
        cx, cy, area = centroid(ring)
        rmax = max(math.hypot(p[0] - cx, p[1] - cy) for p in ring)
        if rmax < 1:
            continue
        ratio = area / (math.pi * rmax * rmax)
        if 0.62 <= ratio <= 0.92:
            print("  %-6s %-20s 环%d 顶点%2d 面积 %7.1f 半径 %5.1f 占比 %.2f" %
                  (b["id"], b["name"][:18], ri, len(ring), area, rmax, ratio))

print("\n=== 多边形内角统计（用于识别八角楼：8 个约 135° 内角）===")
def angles(ring):
    n = len(ring)
    out = []
    for i in range(n):
        p0 = ring[(i - 1) % n]
        p1 = ring[i]
        p2 = ring[(i + 1) % n]
        v1 = (p0[0] - p1[0], p0[1] - p1[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1 = math.hypot(*v1)
        l2 = math.hypot(*v2)
        if l1 < 1e-6 or l2 < 1e-6:
            continue
        cosv = max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)))
        out.append(math.degrees(math.acos(cosv)))
    return out


for b in buildings:
    for ri, ring in enumerate(b["rings"]):
        if len(ring) > 40:
            continue
        ang = angles(ring)
        near135 = [a for a in ang if 125 <= a <= 145]
        if len(near135) >= 6:
            cx, cy, area = centroid(ring)
            print("  %-6s %-20s 环%d 顶点%2d 面积 %7.1f 135°角 %d 个" %
                  (b["id"], b["name"][:18], ri, len(ring), area, len(near135)))
