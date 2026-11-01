# -*- coding: utf-8 -*-
"""把「差几米没接上」的路头焊到最近的道路线上。

背景：roads_clip.py 只处理裁剪产生的新断头，OSM 原本就存在的断头会留着
几米宽的缝，远看就是「一条路走到草地中间就没了」。这里对所有端点做一次
全局焊接：离最近道路线 0.05–LIMIT 米就吸附过去，形成丁字口或十字口。

`--write` 才写回。
"""
import json
import os
import sys

from shapely.geometry import LineString, Point
from shapely.ops import nearest_points, unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "gdufs-3d", "gdufs-data.js")
LIMIT = 15.0


def load():
    t = open(SRC, encoding="utf-8").read()
    return json.JSONDecoder().raw_decode(t[t.index("{"):])[0]


def main():
    write = "--write" in sys.argv
    D = load()
    lines = [(i, j, ln) for i, rd in enumerate(D["roads"]) for j, ln in enumerate(rd.get("lines", []))]
    geo = {(i, j): LineString(ln) for i, j, ln in lines}
    moved = 0
    changes = []

    for i, j, ln in lines:
        for which in (0, -1):
            p = Point(ln[which])
            others = [g for (a, b), g in geo.items() if (a, b) != (i, j)]
            if not others:
                continue
            u = unary_union(others)
            d = u.distance(p)
            if 0.05 < d <= LIMIT:
                q = nearest_points(p, u)[1]
                changes.append((D["roads"][i].get("name"), round(d, 1), ln[which], [round(q.x, 1), round(q.y, 1)]))
                ln[which] = [round(q.x, 1), round(q.y, 1)]
                moved += 1

    print("焊接端点 %d 个" % moved)
    for c in changes[:25]:
        print("  %-18s 缝 %4.1f m  %s → %s" % ((c[0] or "(无名)")[:18], c[1], c[2], c[3]))
    total = sum(LineString(ln).length for _, _, ln in lines)
    print("道路 %d 条 / %d 段 / %.0f m" % (len(D["roads"]), len(lines), total))

    if write:
        text = "window.GDUFS_DATA = " + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + ";\r\n"
        with open(SRC, "w", encoding="utf-8", newline="") as f:
            f.write(text)
        print("已写回", SRC)
    else:
        print("（预演，加 --write 写入）")


if __name__ == "__main__":
    main()
