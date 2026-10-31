# -*- coding: utf-8 -*-
"""北校区人行道补全：官方平面图的道路图层只画了车行道，
宿舍区、教学楼之间的步行小径完全没有，3D 里那一片就是纯草坪。

这里按「每个楼的门口接到最近的路，楼与楼之间按最近邻生成最小生成树」补出步行道，
并用建筑轮廓做碰撞检查——穿楼的连线一律不要。结果作为 highway=footway 交给
tools/build_north_data.py 一起写进 north-data.js。

单独跑：python tools/synth_north_footpaths.py  → artifacts/north/footpath_plan.png
"""
import io
import json
import math
import os

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import linemerge, unary_union

DATA = "gdufs-3d/north-data.js"
OUT_DIR = "artifacts/north"
DOOR_MAX = 42.0      # 门口到最近道路的最大接驳距离（米），超过就不硬接
NEAR_MAX = 90.0      # 楼与楼之间连线的最大长度（米）
GATE_MAX = 160.0     # 校门到最近道路的最大接驳距离（米）
CLEAR = 0.6          # 连线离楼体至少要留的净距（米）
MIN_LEN = 6.0


def _polys(D):
    out = []
    for b in D["buildings"]:
        for ring in b["rings"]:
            if len(ring) < 4:
                continue
            p = Polygon(ring)
            if not p.is_valid:
                p = p.buffer(0)
            if not p.is_empty:
                out.append(p)
    return out


def _segs(roads):
    out = []
    for r in roads:
        for ln in r["lines"]:
            if len(ln) >= 2:
                out.append(LineString(ln))
    return out


def _nearest_on(segs, pt):
    best = None
    for s in segs:
        d = s.distance(pt)
        if best is None or d < best[0]:
            q = s.interpolate(s.project(pt))
            best = (d, (q.x, q.y))
    return best


def _blocks(line, polys, skip):
    probe = line.buffer(CLEAR)
    for i, p in enumerate(polys):
        if i in skip:
            continue
        if probe.intersects(p):
            return True
    return False


def synthesize(D, roads):
    """返回新增的 footway 道路条目列表。"""
    polys = _polys(D)
    segs = _segs(roads)
    if not segs:
        return []

    doors = []
    for bi, b in enumerate(D["buildings"]):
        ring = b["rings"][0]
        best = None
        for p in ring:
            d, q = _nearest_on(segs, Point(p[0], p[1]))
            if best is None or d < best[0]:
                best = (d, (p[0], p[1]), q)
        if best is None:
            continue
        doors.append({"bi": bi, "door": best[1], "road": best[2], "d": best[0]})

    lines = []
    # 门口 -> 最近道路
    for it in doors:
        if it["d"] < 3.0 or it["d"] > DOOR_MAX:
            continue
        ls = LineString([it["door"], it["road"]])
        if _blocks(ls, polys, {it["bi"]}):
            continue
        lines.append(ls)

    # 校门 -> 最近道路：校门是边界上的点，官方图层里没画进校路，必须补一段，
    # 否则导航到校门要在草地上走一百多米。
    for g in D.get("gates") or []:
        gp = Point(g["x"], g["z"])
        best = _nearest_on(segs, gp)
        if not best or best[0] < 3.0 or best[0] > GATE_MAX:
            continue
        ls = LineString([(g["x"], g["z"]), best[1]])
        if _blocks(ls, polys, set()):
            continue
        lines.append(ls)

    # 楼与楼之间：最近邻 + 并查集，避免全连接变蜘蛛网
    parent = list(range(len(doors)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    pairs = []
    for i in range(len(doors)):
        for j in range(i + 1, len(doors)):
            a, b = doors[i]["door"], doors[j]["door"]
            d = math.hypot(a[0] - b[0], a[1] - b[1])
            if d <= NEAR_MAX:
                pairs.append((d, i, j))
    pairs.sort()
    for d, i, j in pairs:
        ri, rj = find(i), find(j)
        if ri == rj:
            continue
        ls = LineString([doors[i]["door"], doors[j]["door"]])
        if _blocks(ls, polys, {doors[i]["bi"], doors[j]["bi"]}):
            continue
        parent[rj] = ri
        lines.append(ls)

    if not lines:
        return []
    merged = linemerge(unary_union(lines))
    geoms = list(merged.geoms) if hasattr(merged, "geoms") else [merged]
    out = []
    for g in geoms:
        if g.is_empty or g.length < MIN_LEN:
            continue
        g = g.simplify(0.6, preserve_topology=False)
        out.append({
            "name": "",
            "highway": "footway",
            "width": 2.6,
            "lines": [[[round(c[0], 2), round(c[1], 2)] for c in g.coords]],
        })
    return out


def main():
    s = io.open(DATA, encoding="utf-8").read()
    i, j = s.index("{"), s.rindex("}")
    D = json.loads(s[i:j + 1])
    foot = synthesize(D, D["roads"])
    print("footway entries %d total %.0f m" % (
        len(foot), sum(sum(math.hypot(ln[k][0] - ln[k - 1][0], ln[k][1] - ln[k - 1][1])
                           for k in range(1, len(ln))) for f in foot for ln in f["lines"])))

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as MPoly

    fig, ax = plt.subplots(figsize=(11, 11), dpi=110)
    for ring in D["boundary"]:
        ax.add_patch(MPoly(ring, closed=True, facecolor="#eef3e6", edgecolor="#3a6b34", lw=1.4, zorder=1))
    for p in _polys(D):
        ax.add_patch(MPoly(list(p.exterior.coords), closed=True, facecolor="#c9c9c9",
                           edgecolor="#8a8a8a", lw=0.4, zorder=3))
    for r in D["roads"]:
        for ln in r["lines"]:
            ax.plot([p[0] for p in ln], [p[1] for p in ln], color="#4f6d8f", lw=1.0, zorder=4)
    for f in foot:
        for ln in f["lines"]:
            ax.plot([p[0] for p in ln], [p[1] for p in ln], color="#d2601a", lw=1.0, zorder=5)
    ax.set_aspect("equal")
    ax.set_title("north campus: synthesized footpaths (orange)")
    fig.tight_layout()
    os.makedirs(OUT_DIR, exist_ok=True)
    fig.savefig(os.path.join(OUT_DIR, "footpath_plan.png"))
    print("wrote footpath_plan.png")


if __name__ == "__main__":
    main()
