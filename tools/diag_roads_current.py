# -*- coding: utf-8 -*-
"""诊断：当前 gdufs-data.js 路网 vs 原始 OSM，按类型着色 + 断头统计。

输出 artifacts/roads/current_vs_raw.png
"""
import collections
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

COLOR = {
    "primary": "#b71c1c", "primary_link": "#e57373",
    "secondary": "#e65100", "secondary_link": "#ffb74d",
    "tertiary": "#f9a825", "tertiary_link": "#fff176",
    "residential": "#6d4c41", "unclassified": "#8d6e63", "service": "#5c6bc0",
    "track": "#26a69a", "motorway": "#7b1fa2",
    "footway": "#2e7d32", "path": "#66bb6a", "steps": "#a5d6a7",
    "pedestrian": "#43a047", "cycleway": "#00acc1",
}


def main():
    d = G.load_data()
    zones = [Polygon(r) for r in d["boundary"]]
    raw = G.load_osm_roads()

    fig, axes = plt.subplots(1, 2, figsize=(18, 10), dpi=100)
    for ax, title in ((axes[0], "current gdufs-data.js roads"), (axes[1], "raw OSM within boundary+35m")):
        for z in zones:
            ax.add_patch(MPoly(list(z.exterior.coords), closed=True, fill=True,
                               facecolor="#f2f5ec", edgecolor="#2e7d32", lw=1.2, ls="--", zorder=0))
        ax.set_aspect("equal")
        ax.grid(alpha=0.15)
        ax.set_title(title)

    # 当前
    stat = collections.Counter()
    seg_lens = []
    for rd in d["roads"]:
        hw = rd.get("highway") or "unknown"
        for ln in rd.get("lines", []):
            ls = LineString(ln)
            seg_lens.append(ls.length)
            stat[hw] += ls.length
            x, y = ls.xy
            axes[0].plot(x, y, color=COLOR.get(hw, "#607d8b"), lw=1.3, zorder=3)

    # 原始（裁到 boundary+35）
    keep = unary_union([z.buffer(35) for z in zones])
    stat2 = collections.Counter()
    for tags, line in raw:
        hw = tags.get("highway")
        if not hw:
            continue
        ls = LineString(line).intersection(keep)
        if ls.is_empty:
            continue
        for part in (ls.geoms if ls.geom_type == "MultiLineString" else [ls]):
            stat2[hw] += part.length
            x, y = part.xy
            axes[1].plot(x, y, color=COLOR.get(hw, "#607d8b"), lw=1.3, zorder=3)

    fig.tight_layout()
    p = os.path.join(OUT, "current_vs_raw.png")
    fig.savefig(p)
    print("图 →", p)
    print("\n当前路网：%d 条，%d 段，总长 %.0f m，中位段长 %.1f m"
          % (len(d["roads"]), len(seg_lens), sum(seg_lens),
             sorted(seg_lens)[len(seg_lens) // 2] if seg_lens else 0))
    print("按类型：")
    for k, v in sorted(stat.items(), key=lambda kv: -kv[1]):
        print("  %-14s %6.0f m" % (k, v))
    print("\n原始（boundary+35m 内裁切后）：")
    for k, v in sorted(stat2.items(), key=lambda kv: -kv[1]):
        print("  %-14s %6.0f m" % (k, v))


if __name__ == "__main__":
    main()
