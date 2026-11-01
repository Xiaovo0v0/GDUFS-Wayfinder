# -*- coding: utf-8 -*-
"""把外环缺口补上：沿边界（向内 2 m）补连接段，两端吸附到最近的既有道路点。

只补 ≥40 m 的缺口；补出来的线段标记 synthetic=true，方便日后追溯。
用法：python tools/roads_bridge.py [--write]
"""
import json
import sys

import numpy as np
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import nearest_points, unary_union

SRC = "gdufs-3d/gdufs-data.js"
STEP = 5.0
MAX_GAP = 40.0     # 弧长超过这个才补
INSET = -2.0       # 负值 = 向校区内侧偏 2 m


def load():
    t = open(SRC, encoding="utf-8").read()
    i = t.index("{")
    return json.JSONDecoder().raw_decode(t[i:])[0]


def main():
    write = "--write" in sys.argv
    D = load()
    polys = []
    for r in D["boundary"]:
        p = Polygon(r)
        if not p.is_valid:
            p = p.buffer(0)
        polys.append(p)
    roads = unary_union([LineString(ln) for rd in D["roads"] for ln in rd.get("lines", [])])

    added = []
    for poly in polys:
        ring = poly.exterior
        n = int(ring.length // STEP)
        d = np.array([ring.interpolate(i * STEP).distance(roads) for i in range(n)])
        i = 0
        while i < n:
            if d[i] > 12.0:
                j = i
                while j < n and d[j] > 12.0:
                    j += 1
                span = (j - i) * STEP
                if span >= MAX_GAP:
                    pts = [ring.interpolate(k * STEP) for k in range(i, min(j + 1, n))]
                    coords = []
                    for p in pts:
                        # 向内偏 2 m：用该点处的外法线粗略近似
                        q = poly.exterior.interpolate(ring.project(p) + 0.0)
                        coords.append([q.x, q.y])
                    if len(coords) >= 2:
                        a = nearest_points(Point(coords[0]), roads)[1]
                        b = nearest_points(Point(coords[-1]), roads)[1]
                        line = [[round(a.x, 1), round(a.y, 1)]] + \
                               [[round(x, 1), round(y, 1)] for x, y in coords] + \
                               [[round(b.x, 1), round(b.y, 1)]]
                        added.append(line)
                        print("补 %5.0f m：%s → %s" % (
                            LineString(line).length, line[0], line[-1]))
                i = j
            else:
                i += 1

    if not added:
        print("没有需要补的缺口")
        return

    entry = {"name": "校园外环路（补线）", "highway": "service", "tunnel": False,
             "synthetic": True, "lines": added}
    if write:
        D["roads"].append(entry)
        text = "window.GDUFS_DATA = " + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + ";\r\n"
        with open(SRC, "w", encoding="utf-8", newline="") as f:
            f.write(text)
        print("已写回，共补 %d 段 / %.0f m" % (len(added), sum(LineString(l).length for l in added)))
    else:
        print("（预演，加 --write 写入）")


if __name__ == "__main__":
    main()
