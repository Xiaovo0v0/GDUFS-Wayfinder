# -*- coding: utf-8 -*-
"""诊断：把原始 OSM 道路按类型画在校区边界上，看边界环路到底缺什么。

输出 artifacts/roads/raw_by_type.png
"""
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MPoly
from shapely.geometry import LineString, Polygon, Point
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo_proj as G  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "artifacts", "roads")
os.makedirs(OUT, exist_ok=True)

VEHICLE = {"primary", "primary_link", "secondary", "secondary_link", "tertiary",
           "tertiary_link", "residential", "unclassified", "service", "track",
           "motorway", "motorway_link", "trunk", "living_street"}
PED = {"footway", "path", "steps", "pedestrian", "cycleway", "corridor"}


def main():
    d = G.load_data()
    roads = G.load_osm_roads()
    e0, n0 = G.origin(d)
    zones = [Polygon(r) for r in d["boundary"]]
    keep = unary_union([z.buffer(30) for z in zones])
    core = unary_union(zones)

    fig, axes = plt.subplots(1, 2, figsize=(18, 10), dpi=100)
    for ax, title in ((axes[0], "raw OSM (all 269 ways)"), (axes[1], "raw within boundary+30m")):
        for z in zones:
            ax.add_patch(MPoly(list(z.exterior.coords), closed=True, fill=False,
                               edgecolor="#2e7d32", lw=1.4, ls="--", zorder=1))
        ax.set_aspect("equal")
        ax.grid(alpha=0.15)
        ax.set_title(title)

    stats = {}
    for tags, line in roads:
        hw = tags.get("highway")
        if not line:
            continue
        ls = LineString(line)
        inmask = ls.intersects(keep)
        color = "#1f77b4" if hw in VEHICLE else ("#d62728" if hw in PED else "#999999")
        lw = 1.4 if hw in ("primary", "secondary", "tertiary") else 0.9
        for ax, only in ((axes[0], False), (axes[1], True)):
            if only and not inmask:
                continue
            x, y = ls.xy
            ax.plot(x, y, color=color, lw=lw, alpha=0.85, zorder=2)
        stats[hw] = stats.get(hw, 0) + (ls.length if inmask else 0)

    for ax in axes:
        for g in d["gates"]:
            if "x" in g:
                ax.plot(g["x"], g["z"], "o", color="#e65100", ms=5, zorder=5)

    fig.tight_layout()
    p = os.path.join(OUT, "raw_by_type.png")
    fig.savefig(p)
    print("图 →", p)
    print("蓝=车行道  红=步行道  灰=其他/未知")
    print("\n边界+30m 内长度（按 highway）：")
    for k, v in sorted(stats.items(), key=lambda kv: -kv[1]):
        if v > 0:
            print("  %-14s %7.0f m" % (str(k), v))
    print("  core area %.0f m², keep area %.0f m²" % (core.area, keep.area))


if __name__ == "__main__":
    main()
