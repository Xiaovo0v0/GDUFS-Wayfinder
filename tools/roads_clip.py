# -*- coding: utf-8 -*-
"""把南校路网裁到校区边界内：只保留校内道路与贴着边界的外环路，去掉伸出校外的路段。

用法：
  python tools/roads_clip.py            # 预演，只打印与出图
  python tools/roads_clip.py --write    # 写回 gdufs-3d/gdufs-data.js
"""
import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPoly
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import nearest_points, unary_union
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "gdufs-3d", "gdufs-data.js")
OUT = os.path.join(ROOT, "artifacts", "roads")
os.makedirs(OUT, exist_ok=True)

MARGIN = 14.0     # 边界外保留 14 m，够画外环路，又不带出城道路
MIN_LEN = 10.0    # 太短的碎段直接丢
SNAP = 30.0       # 断头端 30 m 内有别的路就接上去（做成丁字口）


def load_data():
    text = open(SRC, encoding="utf-8").read()
    i = text.index("{")
    obj, _ = json.JSONDecoder().raw_decode(text[i:])
    return obj


def poly_of(rings):
    ps = []
    for r in rings:
        p = Polygon(r)
        if not p.is_valid:
            p = p.buffer(0)
        if p.area > 0:
            ps.append(p)
    return unary_union(ps)


def parts(geom):
    if geom.is_empty:
        return []
    if geom.geom_type == "LineString":
        return [geom]
    if geom.geom_type == "MultiLineString":
        return [g for g in geom.geoms if g.geom_type == "LineString"]
    if geom.geom_type == "GeometryCollection":
        out = []
        for g in geom.geoms:
            out += parts(g)
        return out
    return []


def main():
    write = "--write" in sys.argv
    D = load_data()
    core = poly_of(D["boundary"])
    keep_poly = core.buffer(MARGIN)

    before_lines = sum(len(r.get("lines", [])) for r in D["roads"])
    before_len = 0.0
    for r in D["roads"]:
        for ln in r.get("lines", []):
            before_len += LineString(ln).length

    new_roads = []
    after_len = 0.0
    after_lines = 0
    dropped = []
    trimmed = []

    for rd in D["roads"]:
        new_lines = []
        old_len = 0.0
        for ln in rd.get("lines", []):
            ls = LineString(ln)
            old_len += ls.length
            # 按顶点裁：落在保留区外的顶点直接丢弃，断口因此垂直于路走向，
            # 不会出现斜切一刀的wëdge（几何求交会产生斜切口）。
            run = []
            runs = []
            for x, y in ls.coords:
                if keep_poly.contains(Point(x, y)):
                    run.append([round(x, 1), round(y, 1)])
                else:
                    if len(run) >= 2:
                        runs.append(run)
                    run = []
            if len(run) >= 2:
                runs.append(run)
            for g in runs:
                if LineString(g).length >= MIN_LEN:
                    new_lines.append(g)
        if not new_lines:
            dropped.append(rd.get("name") or rd.get("highway") or "?")
            continue
        kept_len = sum(LineString(l).length for l in new_lines)
        after_len += kept_len
        after_lines += len(new_lines)
        if kept_len < old_len - 1.0:
            trimmed.append((rd.get("name") or "?", old_len, kept_len))
        rd = dict(rd)
        rd["lines"] = new_lines
        new_roads.append(rd)

    print("道路条目 %d → %d" % (len(D["roads"]), len(new_roads)))
    print("线段 %d → %d" % (before_lines, after_lines))
    print("总长 %.0f m → %.0f m（去掉 %.0f m）" % (before_len, after_len, before_len - after_len))
    print("整条丢弃 %d 条：%s" % (len(dropped), "、".join(sorted(set(dropped))[:12])))
    print("被裁剪 %d 条，前 10：" % len(trimmed))
    for name, o, k in sorted(trimmed, key=lambda t: -(t[1] - t[2]))[:10]:
        print("  %-22s %.0f → %.0f m" % (name, o, k))
    # --- 断头端吸附：裁出来的断口若 30 m 内有别的路，就接到那条路上（做成丁字口） ---
    entries = []
    geoms = []
    for ri, rd in enumerate(new_roads):
        for li in range(len(rd["lines"])):
            entries.append((ri, li))
            geoms.append(LineString(rd["lines"][li]))
    tree = STRtree(geoms)
    snapped = 0
    for gi, g in enumerate(geoms):
        ri, li = entries[gi]
        line = new_roads[ri]["lines"][li]
        for which in (0, -1):
            p = Point(line[which])
            if core.contains(p):
                continue                      # 端点在校区内，不需要接
            cand = tree.query(p.buffer(SNAP))
            best = None
            for ci in cand:
                ci = int(ci)
                if ci == gi:
                    continue
                q = nearest_points(p, geoms[ci])[1]
                dd = p.distance(q)
                if dd <= SNAP and (best is None or dd < best[0]):
                    best = (dd, q)
            if best:
                line[which] = [round(best[1].x, 1), round(best[1].y, 1)]
                snapped += 1
    print("断头端吸附 %d 处（阈值 %.0f m）" % (snapped, SNAP))

    # 出图对照
    fig, axes = plt.subplots(1, 2, figsize=(17, 8.5))
    for ax, roads, title in ((axes[0], D["roads"], "before"), (axes[1], new_roads, "after")):
        for ring in D["boundary"]:
            ax.add_patch(MplPoly(ring, closed=True, fill=True, facecolor="#eef2e8",
                                 edgecolor="#587a3c", linewidth=1.2, zorder=0))
        for rd in roads:
            for ln in rd.get("lines", []):
                ls = LineString(ln)
                x, y = ls.xy
                ax.plot(x, y, color="#3f4a52", linewidth=1.0, zorder=2)
        ax.set_aspect("equal")
        ax.set_title(title)
        ax.grid(alpha=0.15)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "clip_compare.png"), dpi=100)
    print("图 →", os.path.join(OUT, "clip_compare.png"))

    if not write:
        print("（预演，未写入；加 --write 写回）")
        return

    D["roads"] = new_roads
    text = "window.GDUFS_DATA = " + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + ";\r\n"
    with open(SRC, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("已写回", SRC, "%.1f KB" % (len(text.encode("utf-8")) / 1024))


if __name__ == "__main__":
    main()
