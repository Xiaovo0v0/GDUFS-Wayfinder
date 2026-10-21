"""把 north_buildings.json 转成前端可直接加载的 north-data.js。

北校目前只有建筑轮廓（道路/水系/校门在 B8-3 补），所以：
  - boundary 用所有建筑的外包凸壳向外扩 60 m 生成
  - roads / water / waterPolygons / landscape / gates / graph 给空数组
  - places 由有名建筑生成（供地名解析与下拉框使用）
"""
import json
import os

import numpy as np
from shapely.geometry import MultiPoint, Polygon
from shapely.ops import unary_union

SRC = r"data\official\north_buildings.json"
DST = r"gdufs-3d\north-data.js"

with open(SRC, encoding="utf-8") as f:
    raw = json.load(f)

buildings = []
for b in raw["buildings"]:
    bid = "N%03d" % b["index"]
    buildings.append({
        "id": bid,
        "index": b["index"],
        "name": b["name"],
        "type": b["type"],
        "levels": b["levels"],
        "height": b["height"],
        "area": b["area"],
        "rings": [b["ring"]],
        "centroid": b["centroid"],
        "name_confidence": b["name_confidence"],
        "campus": "north",
    })

# 边界：建筑群的凸壳外扩
polys = [Polygon(b["rings"][0]) for b in buildings if len(b["rings"][0]) >= 4]
hull = unary_union(polys).convex_hull.buffer(60, join_style=2)
boundary_ring = [[round(x, 1), round(y, 1)] for x, y in hull.exterior.coords]

# 地名（供 findPlace / 下拉框）
places = []
for b in buildings:
    if not b["name"]:
        continue
    cx, cz = b["centroid"]
    places.append({
        "label": b["name"],
        "x": cx,
        "z": cz,
        "building": b["id"],
        "type": b["type"],
    })

data = {
    "meta": {
        "name": "广东外语外贸大学 白云山校区（北校区）",
        "campus": "north",
        "origin_wgs84": None,
        "crs_local": "x=西向(m), z=北向(m), y=高度(m)",
        "bounds_m": {
            "x": [round(min(p[0] for r in [boundary_ring] for p in r), 1),
                  round(max(p[0] for r in [boundary_ring] for p in r), 1)],
            "y": [0, 30],
            "z": [round(min(p[1] for r in [boundary_ring] for p in r), 1),
                  round(max(p[1] for r in [boundary_ring] for p in r), 1)],
        },
        "note": "轮廓来自学校官方《北校区平面图》矢量化（跑道标定 0.4178 m/px）；"
                "层数为按建筑类型推定，非官方数据；道路/水系/校门待补",
        "sources": ["https://yx.gdufs.edu.cn/n.jpg (官方北校区平面图)"],
    },
    "buildings": buildings,
    "boundary": [boundary_ring],
    "roads": [],
    "water": [],
    "waterPolygons": [],
    "landscape": [],
    "gates": [],
    "places": places,
}

js = "window.GDUFS_NORTH = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
os.makedirs(os.path.dirname(DST), exist_ok=True)
with open(DST, "w", encoding="utf-8") as f:
    f.write(js)

print("建筑 %d 栋，有名 %d，边界顶点 %d" % (
    len(buildings), len(places), len(boundary_ring)))
print("输出", DST, os.path.getsize(DST), "bytes")
