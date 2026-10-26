# -*- coding: utf-8 -*-
"""用 Overpass API 拉取行政办公楼周边的建筑轮廓，寻找八角形建筑。

用法：python tools/probe_octagon_osm.py
"""
import json
import math
import urllib.parse
import urllib.request

# 行政办公楼质心（本地坐标 m，x 西为正）→ WGS84 近似
O_LON, O_LAT = 113.39215489681557, 23.066554348076398
M_LAT = 110950.0
M_LON = 102400.0


def to_lonlat(x, z):
    # x 向西为正 → 经度减小；z 向北为正
    return O_LON - x / M_LON, O_LAT + z / M_LAT


AX, AZ = -236.6, -173.2
lon, lat = to_lonlat(AX, AZ)
print("行政办公楼约在 %.6f, %.6f" % (lat, lon))

D = 0.0018  # ≈200 m
s, w, n, e = lat - D, lon - D, lat + D, lon + D
q = f"""
[out:json][timeout:60];
(
  way["building"]({s},{w},{n},{e});
);
out geom tags;
"""
url = "https://overpass-api.de/api/interpreter?data=" + urllib.parse.quote(q)
req = urllib.request.Request(url, headers={"User-Agent": "gdufs-wayfinder/1.0 (research)"})
with urllib.request.urlopen(req, timeout=120) as r:
    data = json.load(r)

print("ways:", len(data.get("elements", [])))
best = []
for el in data.get("elements", []):
    geom = el.get("geometry") or []
    if len(geom) < 3:
        continue
    tags = el.get("tags", {})
    # 质心
    xs = [p["lon"] for p in geom]
    ys = [p["lat"] for p in geom]
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    dx = (cx - lon) * M_LON
    dy = (cy - lat) * M_LAT
    dist = math.hypot(dx, dy)
    if dist > 160:
        continue
    # 内角
    ang = []
    k = len(geom)
    for i in range(k):
        p0 = geom[(i - 1) % k]
        p1 = geom[i]
        p2 = geom[(i + 1) % k]
        v1 = (p0["lon"] - p1["lon"], p0["lat"] - p1["lat"])
        v2 = (p2["lon"] - p1["lon"], p2["lat"] - p1["lat"])
        l1 = math.hypot(*v1)
        l2 = math.hypot(*v2)
        if l1 < 1e-12 or l2 < 1e-12:
            continue
        c = max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)))
        ang.append(math.degrees(math.acos(c)))
    n135 = sum(1 for a in ang if 120 <= a <= 150)
    best.append((dist, el.get("id"), k, n135, tags.get("name", ""), tags.get("building", ""), tags))

best.sort()
for dist, wid, k, n135, name, btype, tags in best:
    print("  %6.1f m  way/%-12s 顶点%2d  135°角%2d  %-18s %s" % (dist, wid, k, n135, name or "-", btype))
