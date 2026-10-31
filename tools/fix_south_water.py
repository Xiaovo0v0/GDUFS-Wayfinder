# -*- coding: utf-8 -*-
"""南校区水系去重：OSM 的 waterway 中心线与 natural=water 面是同一水体，
同时渲染会出现「蓝色带子压在湖面上、端头切出阶梯状锯齿」。

这里把「缓冲后 >=80% 面积落在已有水面多边形内」的 waterway 线删掉，
只保留真正独立、不被水面覆盖的河涌段。

用法：
    python tools/fix_south_water.py            # 只报告
    python tools/fix_south_water.py --write    # 写回 gdufs-data.js
"""
from __future__ import print_function

import io
import json
import os
import shutil
import sys

from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "gdufs-3d", "gdufs-data.js")

COVER_DROP = 0.80
WIDTH = {"river": 11.0, "canal": 7.0, "stream": 7.0}


def load(path=DATA):
    raw = io.open(path, encoding="utf-8").read()
    i, j = raw.index("{"), raw.rindex("}")
    return json.loads(raw[i:j + 1]), raw[:i], raw[j + 1:]


def save(path, D, head, tail):
    if not tail.strip().startswith(";"):
        tail = ";" + tail
    txt = head + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + tail
    io.open(path, "w", encoding="utf-8").write(txt)


def water_union(D):
    polys = []
    for w in D.get("waterPolygons") or []:
        for r in w.get("rings") or []:
            if len(r) >= 3:
                p = Polygon(r)
                if not p.is_valid:
                    p = p.buffer(0)
                if not p.is_empty:
                    polys.append(p)
    if not polys:
        return None
    return unary_union(polys)


def main():
    write = "--write" in sys.argv
    D, head, tail = load()
    u = water_union(D)
    if u is None:
        print("没有水面多边形，跳过")
        return
    keep, drop = [], []
    for w in D.get("water") or []:
        wd = WIDTH.get(w.get("kind"), 7.0)
        lines = []
        for l in w.get("lines") or []:
            if len(l) < 2:
                continue
            g = LineString(l).buffer(wd / 2.0)
            if g.area <= 0:
                lines.append(l)
                continue
            cover = g.intersection(u).area / g.area
            if cover >= COVER_DROP:
                drop.append((w.get("kind"), w.get("name"), round(LineString(l).length, 1), round(cover, 3)))
            else:
                lines.append(l)
                keep.append((w.get("kind"), round(LineString(l).length, 1), round(cover, 3)))
        w["lines"] = lines
    D["water"] = [w for w in D.get("water") or [] if w.get("lines")]

    print("保留 %d 段:" % len(keep))
    for k in keep:
        print("   ", k)
    print("删除 %d 段（已被水面多边形覆盖）:" % len(drop))
    for d in drop:
        print("   ", d)

    if write:
        bak = DATA + ".before-water"
        if not os.path.exists(bak):
            shutil.copyfile(DATA, bak)
        save(DATA, D, head, tail)
        print("已写回 %s" % DATA)


if __name__ == "__main__":
    main()
