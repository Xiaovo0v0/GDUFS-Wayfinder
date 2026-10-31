# -*- coding: utf-8 -*-
"""找出「孤立路片」：两端都接不上任何其它道路、长度又很短的线。

用户反馈「道路断开、一节一节」，除了整条路被剪断，还有一类是
裁剪/焊接之后留下的碎头：孤零零躺在草地上，远看就是一条白色小短线。
"""
import io
import json
import math
import sys

from shapely.geometry import LineString, Point
from shapely.ops import unary_union

sys.path.insert(0, "tools")


def load(path):
    s = io.open(path, encoding="utf-8").read()
    i, j = s.index("{"), s.rindex("}")
    return json.loads(s[i:j + 1])


def main(path, touch=6.0, max_len=90.0):
    D = load(path)
    segs = []
    for r in D["roads"]:
        for ln in r["lines"]:
            if len(ln) >= 2:
                segs.append((r, ln, LineString(ln)))
    # 每个端点：除自己以外，别的道路里有没有点落在 touch 米内
    orphan = []
    for idx, (r, ln, ls) in enumerate(segs):
        ends = [Point(ln[0]), Point(ln[-1])]
        others = [s for k, (_, _, s) in enumerate(segs) if k != idx]
        if not others:
            orphan.append((r, ls, "only-road"))
            continue
        joined = [any(s.distance(e) <= touch for s in others) for e in ends]
        if not any(joined) and ls.length <= max_len:
            orphan.append((r, ls, "%.0fm" % ls.length))
    print("%s: roads %d segs %d orphans %d" % (path, len(D["roads"]), len(segs), len(orphan)))
    for r, ls, why in orphan:
        c = ls.centroid
        print("  %-9s %-8s len=%5.0fm at (%7.1f,%7.1f)  %s"
              % (r.get("highway") or "?", why, ls.length, c.x, c.y, r.get("name") or ""))
    return orphan


if __name__ == "__main__":
    p = sys.argv[1] if len(sys.argv) > 1 else "gdufs-3d/gdufs-data.js"
    main(p)
