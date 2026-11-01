# -*- coding: utf-8 -*-
"""水面多边形圆滑：OSM/栅格描出来的湖岸是折线，顶点稀疏，3D 俯视时
会出现一段段直边和折角，看着像阶梯锯齿。这里用 Chaikin 割角法细分两轮，
把折角磨圆，同时保持形状与面积基本不变。

用法：
    python tools/smooth_water.py            # 只报告
    python tools/smooth_water.py --write    # 写回
    python tools/smooth_water.py --write --iter 3
"""
from __future__ import print_function

import io
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TARGETS = [
    os.path.join(ROOT, "gdufs-3d", "gdufs-data.js"),
    os.path.join(ROOT, "gdufs-3d", "north-data.js"),
]


def load(path):
    raw = io.open(path, encoding="utf-8").read()
    i, j = raw.index("{"), raw.rindex("}")
    return json.loads(raw[i:j + 1]), raw[:i], raw[j + 1:]


def save(path, D, head, tail):
    if not tail.strip().startswith(";"):
        tail = ";" + tail
    txt = head + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + tail
    io.open(path, "w", encoding="utf-8").write(txt)


def open_ring(ring):
    pts = [[p[0], p[1]] for p in ring]
    if len(pts) > 1 and abs(pts[0][0] - pts[-1][0]) < 1e-6 and abs(pts[0][1] - pts[-1][1]) < 1e-6:
        pts = pts[:-1]
    return pts


def chaikin(pts, iters):
    for _ in range(iters):
        out = []
        n = len(pts)
        for k in range(n):
            a = pts[k]
            b = pts[(k + 1) % n]
            out.append([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25])
            out.append([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
        pts = out
    return pts


def round_ring(ring, iters, decimals=1, tol=0.55):
    pts = chaikin(open_ring(ring), iters)
    # 细分后点数会翻 4 倍，用 Douglas-Peucker 收回来（0.55 m 以内误差，肉眼无差）
    try:
        from shapely.geometry import Polygon
        g = Polygon(pts)
        if g.is_valid and g.area > 0:
            g = g.simplify(tol, preserve_topology=True)
            if g.geom_type == "MultiPolygon":
                g = max(g.geoms, key=lambda q: q.area)
            pts = [[p[0], p[1]] for p in g.exterior.coords]
    except Exception:
        pass
    out = [[round(p[0], decimals), round(p[1], decimals)] for p in pts]
    if abs(out[0][0] - out[-1][0]) > 1e-9 or abs(out[0][1] - out[-1][1]) > 1e-9:
        out.append([out[0][0], out[0][1]])
    # 去掉重复点
    clean = [out[0]]
    for p in out[1:]:
        if abs(p[0] - clean[-1][0]) > 1e-9 or abs(p[1] - clean[-1][1]) > 1e-9:
            clean.append(p)
    if len(clean) > 2 and abs(clean[0][0] - clean[-1][0]) < 1e-9 and abs(clean[0][1] - clean[-1][1]) < 1e-9:
        clean[-1] = [clean[0][0], clean[0][1]]
    return clean


def area(ring):
    s = 0.0
    for k in range(len(ring) - 1):
        s += ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1]
    return abs(s) / 2.0


def main():
    write = "--write" in sys.argv
    iters = 2
    if "--iter" in sys.argv:
        iters = int(sys.argv[sys.argv.index("--iter") + 1])

    for path in TARGETS:
        if not os.path.exists(path):
            continue
        D, head, tail = load(path)
        polys = D.get("waterPolygons") or []
        if not polys:
            print("%s: 无水面多边形" % os.path.basename(path))
            continue
        print("%s: %d 个水面，Chaikin %d 轮" % (os.path.basename(path), len(polys), iters))
        for w in polys:
            rings = []
            for r in w.get("rings") or []:
                if len(r) < 4:
                    rings.append(r)
                    continue
                a0 = area(r)
                nr = round_ring(r, iters)
                a1 = area(nr)
                print("   %-12s 点 %d -> %d  面积 %.0f -> %.0f (%+.2f%%)"
                      % (w.get("name") or "-", len(r), len(nr), a0, a1, (a1 - a0) / a0 * 100.0))
                rings.append(nr)
            w["rings"] = rings
        if write:
            bak = path + ".before-smooth"
            if not os.path.exists(bak):
                shutil.copyfile(path, bak)
            save(path, D, head, tail)
            print("   已写回 %s" % os.path.basename(path))


if __name__ == "__main__":
    main()
