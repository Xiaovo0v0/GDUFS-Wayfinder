# -*- coding: utf-8 -*-
"""按「建成区 + 外围环路走廊」重新挑选南校道路。

思路
----
OSM 的校区多边形比实际建成区大得多，空地也被算进「校内」，所以只按边界裁
会让一些路看起来修在荒地中间。反过来只按「建筑外扩 60 m」裁，又会把真正
围着楼群的那一圈外环路一起剪掉。

这个脚本把两者合起来：保留区 = 建筑外扩 60 m ∪ 每个校区的凹包外扩 45 m（外围环路走廊）
∪ 校门 30 m。凹包（concave_hull）贴着楼群外缘走，正好圈出「外围道路」该在的那条带。

用法
----
    python tools/roads_ring.py                 # 只出统计和对照图
    python tools/roads_ring.py --write         # 写回 gdufs-3d/gdufs-data.js
    python tools/roads_ring.py --source REV    # 从 git 历史里取原始道路（默认 90bc64a）
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

from shapely.geometry import LineString, Polygon, MultiPolygon, box
from shapely.ops import unary_union
from shapely import concave_hull

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "gdufs-3d" / "gdufs-data.js"
OUT = ROOT / "artifacts" / "roads"

BUILT_BUFFER = 60.0
RING_BUFFER = 45.0
GATE_BUFFER = 30.0
MIN_LEN = 10.0
SNAP = 30.0


def load_js(path):
    text = path.read_text(encoding="utf-8")
    i = text.index("{")
    obj, _ = json.JSONDecoder().raw_decode(text[i:])
    return obj, text[:i], text[i + len(json.dumps(obj, ensure_ascii=False)):]


def load_from_git(rev):
    raw = subprocess.check_output(
        ["git", "show", "%s:gdufs-3d/gdufs-data.js" % rev], cwd=str(ROOT)
    ).decode("utf-8")
    i = raw.index("{")
    obj, _ = json.JSONDecoder().raw_decode(raw[i:])
    return obj


def polys_of(buildings):
    out = []
    for b in buildings:
        for ring in b.get("rings") or []:
            if len(ring) >= 3:
                p = Polygon([(q[0], q[1]) for q in ring])
                if not p.is_valid:
                    p = p.buffer(0)
                if p.area > 1.0:
                    out.append(p)
    return out


def boundary_polys(boundary):
    if isinstance(boundary, list) and boundary and isinstance(boundary[0], list) \
            and boundary[0] and isinstance(boundary[0][0], list) \
            and boundary[0][0] and isinstance(boundary[0][0][0], (int, float)):
        boundary = [boundary]
    out = []
    for ps in boundary:
        for ring in ps:
            if len(ring) >= 3:
                p = Polygon([(q[0], q[1]) for q in ring])
                if not p.is_valid:
                    p = p.buffer(0)
                out.append(p)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--source", default="90bc64a", help="从该 commit 取原始道路")
    ap.add_argument("--built", type=float, default=BUILT_BUFFER)
    ap.add_argument("--ring", type=float, default=RING_BUFFER)
    args = ap.parse_args()

    cur, head, tail = load_js(DATA)
    orig = load_from_git(args.source)
    roads = orig["roads"]
    buildings = cur["buildings"]
    gates = cur.get("gates") or []

    bpolys = polys_of(buildings)
    zones = boundary_polys(cur["boundary"])
    if not zones:
        zones = [unary_union(bpolys).convex_hull]
    print("建筑多边形 %d 个，校区多边形 %d 个" % (len(bpolys), len(zones)))

    built = unary_union(bpolys).buffer(args.built, join_style=2)

    bands = []
    for z in zones:
        inside = [p for p in bpolys if p.representative_point().within(z)]
        if not inside:
            continue
        u = unary_union(inside)
        hull = concave_hull(u, ratio=0.3, allow_holes=False)
        if hull.geom_type == "Polygon":
            bands.append(hull.buffer(args.ring, join_style=2))
        print("  校区 %6.0f m²：落楼 %d 栋，凹包 %6.0f m²，环带缓冲 %.0f m"
              % (z.area, len(inside), hull.area, args.ring))

    gbuf = [Polygon([(g["x"] - 1, g["z"] - 1), (g["x"] + 1, g["z"] - 1),
                     (g["x"] + 1, g["z"] + 1), (g["x"] - 1, g["z"] + 1)]).buffer(GATE_BUFFER)
            for g in gates if "x" in g and "z" in g]

    mask = unary_union([built] + bands + gbuf)

    before_len = sum(len(l) for r in roads for l in r["lines"]) and None
    def total(rs):
        s = 0.0
        for r in rs:
            for line in r["lines"]:
                for i in range(len(line) - 1):
                    s += ((line[i][0] - line[i + 1][0]) ** 2 + (line[i][1] - line[i + 1][1]) ** 2) ** 0.5
        return s

    out_roads, kept_n, dropped_n = [], 0, 0
    removed_lines = []
    from shapely.geometry import Point

    def inside(x, y):
        return mask.distance(Point(x, y)) <= 0.5

    for r in roads:
        new_lines = []
        for line in r["lines"]:
            run, cut = [], []
            for p in line:
                if inside(p[0], p[1]):
                    run.append(p)
                    if len(cut) >= 2:
                        removed_lines.append(cut)
                    cut = []
                else:
                    cut.append(p)
                    if len(run) >= 2:
                        new_lines.append(run)
                    run = []
            if len(run) >= 2:
                new_lines.append(run)
            if len(cut) >= 2:
                removed_lines.append(cut)

        # 线段太短就丢掉
        new_lines = [ln for ln in new_lines
                     if sum(((ln[i][0] - ln[i + 1][0]) ** 2 + (ln[i][1] - ln[i + 1][1]) ** 2) ** 0.5
                            for i in range(len(ln) - 1)) >= MIN_LEN]
        if new_lines:
            r2 = dict(r)
            r2["lines"] = new_lines
            out_roads.append(r2)
            kept_n += 1
        else:
            dropped_n += 1

    print("\n道路条目 %d → %d（丢弃 %d）" % (len(roads), kept_n, dropped_n))
    print("总长 %.0f m → %.0f m" % (total(roads), total(out_roads)))

    # 外围环路闭合度：沿凹包外缘每 5 m 采点，看 12 m 内有没有保留下来的路
    kept_lines = [LineString([(p[0], p[1]) for p in ln])
                  for r in out_roads for ln in r["lines"] if len(ln) >= 2]
    kept_u = unary_union(kept_lines) if kept_lines else None
    print("\n外围环路闭合度（沿凹包外缘每 5 m 采点，12 m 内有路算闭合）：")
    for z in zones:
        inside = [p for p in bpolys if p.representative_point().within(z)]
        if not inside:
            continue
        hull = concave_hull(unary_union(inside), ratio=0.3, allow_holes=False)
        ext = hull.exterior
        n = max(2, int(ext.length / 5.0))
        hit = 0
        worst = 0.0
        worst_at = None
        for i in range(n):
            pt = ext.interpolate(i * ext.length / n)
            d = kept_u.distance(pt) if kept_u is not None else 9999
            if d <= 12.0:
                hit += 1
            elif d > worst:
                worst, worst_at = d, pt
        print("  校区 %6.0f m²：周长 %5.0f m，闭合 %5.1f%%，最大缺口 %5.1f m%s"
              % (z.area, ext.length, 100.0 * hit / n, worst,
                 "" if worst_at is None else " @(%.0f,%.0f)" % (worst_at.x, worst_at.y)))

    if args.write:
        out = dict(cur)
        out["roads"] = out_roads
        DATA.write_text(head + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + tail,
                        encoding="utf-8")
        print("已写回 %s" % DATA)

    # 对照图
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.patches import Polygon as MPoly

        fig, ax = plt.subplots(figsize=(13, 11), dpi=110)
        for p in bpolys:
            ax.add_patch(MPoly(list(p.exterior.coords), closed=True,
                               facecolor="#8a8f96", edgecolor="none", alpha=0.9))
        for z in zones:
            xs, ys = z.exterior.xy
            ax.plot(xs, ys, color="#2e7d32", lw=1.6, ls="--", label="校区边界")
        for b in bands:
            xs, ys = b.exterior.xy
            ax.plot(xs, ys, color="#1565c0", lw=1.0, alpha=0.8)
        for r in roads:
            for line in r["lines"]:
                xs = [p[0] for p in line]
                ys = [p[1] for p in line]
                ax.plot(xs, ys, color="#b0b0b0", lw=0.9, zorder=1)
        for line in removed_lines:
            xs = [p[0] for p in line]
            ys = [p[1] for p in line]
            ax.plot(xs, ys, color="#d32f2f", lw=1.6, zorder=3)
        for r in out_roads:
            for line in r["lines"]:
                xs = [p[0] for p in line]
                ys = [p[1] for p in line]
                ax.plot(xs, ys, color="#1b1b1b", lw=1.2, zorder=4)
        for g in gates:
            if "x" in g:
                ax.plot(g["x"], g["z"], "o", color="#e65100", ms=5, zorder=5)
                ax.annotate(g["name"][:9], (g["x"], g["z"]), fontsize=7, color="#e65100")
        ax.set_aspect("equal")
        ax.grid(alpha=0.2)
        ax.set_title("黑=保留  红=剪掉  蓝线=外围环路走廊  灰=建筑")
        OUT.mkdir(parents=True, exist_ok=True)
        fig.tight_layout()
        fig.savefig(OUT / "ring_plan.png")
        print("对照图 %s" % (OUT / "ring_plan.png"))
    except Exception as e:  # noqa
        print("对照图生成失败：%r" % (e,))


if __name__ == "__main__":
    sys.exit(main())
