# -*- coding: utf-8 -*-
"""修剪「悬在空地里」的断头路。

判据：某一段的端点同时满足
  1) 悬挂——8 m 内没有别的道路线；
  2) 深入校区——离校区边界 > DEEP m（贴边界的断头是路出校门，属正常）；
  3) 孤零零——32 m 内没有建筑。
就沿该段往回退，退到第一个「有建筑或有别的路」的顶点；退完不足 MIN_KEEP 米就整段删掉。

`--write` 才写回，否则只打印将要做的事。
"""
import json
import os
import sys

import numpy as np
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "gdufs-3d", "gdufs-data.js")

SNAP = 8.0       # 端点 8 m 内有别的路 = 已接上
DEEP = 22.0      # 离边界 22 m 内算贴边，不动
NEAR_BLD = 32.0  # 32 m 内有建筑算有依托
MIN_KEEP = 15.0  # 退完不足 15 m 的整段删掉


def load():
    t = open(SRC, encoding="utf-8").read()
    return json.JSONDecoder().raw_decode(t[t.index("{"):])[0]


def build_unions(D, skip=None):
    segs = []
    for i, rd in enumerate(D["roads"]):
        if i == skip:
            continue
        for ln in rd.get("lines", []):
            segs.append(LineString(ln))
    roads = unary_union(segs) if segs else None
    bld = unary_union([Polygon(b["rings"][0]).buffer(0) for b in D["buildings"]])
    boundary = unary_union([Polygon(r).buffer(0).exterior for r in D["boundary"]])
    return roads, bld, boundary


def main():
    write = "--write" in sys.argv
    D = load()
    bld = unary_union([Polygon(b["rings"][0]).buffer(0) for b in D["buildings"]])
    boundary = unary_union([Polygon(r).buffer(0).exterior for r in D["boundary"]])
    alllines = [LineString(ln) for rd in D["roads"] for ln in rd.get("lines", [])]

    trimmed, dropped = [], []
    for rd in D["roads"]:
        keep = []
        for ln in rd.get("lines", []):
            others = unary_union([l for l in alllines if l is not ln and not l.equals(LineString(ln))])
            pts = [list(p) for p in ln]

            def bad(p):
                pt = Point(p)
                return (others.distance(pt) > SNAP
                        and boundary.distance(pt) > DEEP
                        and bld.distance(pt) > NEAR_BLD)

            changed = False
            while len(pts) > 2 and bad(pts[0]):
                pts.pop(0)
                changed = True
            while len(pts) > 2 and bad(pts[-1]):
                pts.pop()
                changed = True
            if LineString(pts).length < MIN_KEEP:
                dropped.append((rd.get("name"), round(LineString(ln).length)))
                changed = True
                continue
            if changed:
                trimmed.append((rd.get("name"), round(LineString(ln).length, 0),
                                round(LineString(pts).length, 0)))
            keep.append(pts)
        rd["lines"] = keep
    D["roads"] = [rd for rd in D["roads"] if rd.get("lines")]

    print("修剪线段 %d 条，删除线段 %d 条" % (len(trimmed), len(dropped)))
    for t in trimmed[:20]:
        print("  修剪 %-20s %5.0f m → %5.0f m" % ((t[0] or "(无名)")[:20], t[1], t[2]))
    for d in dropped[:20]:
        print("  删除 %-20s %5.0f m" % ((d[0] or "(无名)")[:20], d[1]))
    total = sum(LineString(ln).length for rd in D["roads"] for ln in rd["lines"])
    print("剩余：%d 条 / %d 段 / %.0f m" % (len(D["roads"]), sum(len(r["lines"]) for r in D["roads"]), total))

    if write:
        text = "window.GDUFS_DATA = " + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + ";\r\n"
        with open(SRC, "w", encoding="utf-8", newline="") as f:
            f.write(text)
        print("已写回", SRC)
    else:
        print("（预演，加 --write 写入）")


if __name__ == "__main__":
    main()
