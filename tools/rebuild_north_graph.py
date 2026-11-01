# -*- coding: utf-8 -*-
"""只重建北校导航图（graph + 建筑/校门/地点 node），不动道路几何。

背景
----
南校修完「路线跑到校外马路上」之后，用同一把尺子量北校：561 组两两路线里
169 组有 >>5 m 在校区多边形外，最狠的「第七教学楼→BBA教育中心」有 77.9 m
在校外——它是沿着围墙外的步道走的，和南校是同一类问题。

与南校的差别（重要）
----
北校的 `highway` 是按路宽猜的，14.6 m 的 `secondary` 其实是校内主路。照南校
「primary/secondary/tertiary 整条剔除」的口径会把主路网剔空，所以这里传
`city_roads=set()`：北校只靠「裁剪到校区多边形以内」这一条来保证不出校。

用法
----
    python tools/rebuild_north_graph.py            # 预演：统计 + 对照图
    python tools/rebuild_north_graph.py --write    # 写回 gdufs-3d/north-data.js
"""
import argparse
import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MPoly
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rebuild_roads as R  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "gdufs-3d", "north-data.js")
OUT = os.path.join(ROOT, "artifacts", "nav")
os.makedirs(OUT, exist_ok=True)


def load_north():
    raw = open(DATA, encoding="utf-8").read()
    i = raw.index("{")
    D, end = json.JSONDecoder().raw_decode(raw[i:])
    return D, raw[:i], raw[i + end:]


def outside_len(D, pts):
    camp = unary_union([Polygon(r) for r in D["boundary"] if len(r) >= 4]).buffer(0)
    ls = LineString([tuple(p) for p in pts])
    return ls.length - ls.intersection(camp).length


def plot_compare(D, old_graph, new_graph, path):
    matplotlib.rcParams["font.family"] = ["Microsoft YaHei", "SimHei", "DejaVu Sans"]
    matplotlib.rcParams["axes.unicode_minus"] = False
    zones = [Polygon(r) for r in D["boundary"]]
    fig, axes = plt.subplots(1, 2, figsize=(16, 12), dpi=100)
    for ax, graph, title in ((axes[0], old_graph, "before (贴着围墙外侧的步道进了图)"),
                             (axes[1], new_graph, "after (只走校内道路)")):
        for z in zones:
            ax.add_patch(MPoly(list(z.exterior.coords), closed=True, fill=True,
                               facecolor="#f2f5ec", edgecolor="#2e7d32", lw=1.2, ls="--", zorder=0))
        for b in D["buildings"]:
            for ring in b.get("rings") or []:
                ax.add_patch(MPoly(ring, closed=True, fill=True, facecolor="#e8eaed",
                                   edgecolor="none", zorder=1))
        for e in graph.get("edges") or []:
            pts = e.get("pts") or []
            if len(pts) < 2:
                continue
            color = "#c62828" if e.get("connector") else "#1565c0"
            ax.plot([p[0] for p in pts], [p[1] for p in pts],
                    ":" if e.get("connector") else "-", color=color,
                    lw=1.0 if e.get("connector") else 1.4, zorder=3)
        for g in D.get("gates") or []:
            if "x" not in g:
                continue
            ax.plot(g["x"], g["z"], "s", color="#e65100", ms=5, zorder=6)
            ax.annotate(g.get("name") or "", (g["x"], g["z"]), fontsize=6, color="#e65100")
        ax.set_aspect("equal")
        ax.grid(alpha=0.15)
        ax.set_title(title)
    fig.tight_layout()
    fig.savefig(path)
    print("对照图 →", path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--join", type=float, default=30.0)
    ap.add_argument("--door", type=float, default=R.DOOR_MAX)
    args = ap.parse_args()

    D, head, tail = load_north()
    old_graph = json.loads(json.dumps(D.get("graph") or {"nodes": [], "edges": []}))
    old_nodes = {b.get("id"): b.get("node") for b in D["buildings"]}

    gb, repaired, comp, off_b, off_g = R.build_graph(
        D, D["roads"], join_max=args.join, door_max=args.door, city_roads=set())
    new_graph = {"nodes": gb.nodes, "edges": gb.edges}

    print("导航图：节点 %d，边 %d（旧 %d/%d），连通分量 %d，缝合边 %d"
          % (len(gb.nodes), len(gb.edges), len(old_graph["nodes"]), len(old_graph["edges"]),
             len(comp), repaired))
    print("脱离主分量的建筑 %d 个：%s" % (len(off_b), off_b[:8]))
    print("脱离主分量的校门 %d 个：%s" % (len(off_g), off_g[:8]))
    far = sorted([(b.get("access_dist"), b["name"]) for b in D["buildings"] if b.get("name")],
                 key=lambda t: -(t[0] or 0))
    print("接驳距离最远 8 个：%s" % far[:8])
    print("校门接驳：%s" % [(g.get("name"), g.get("access_dist")) for g in D["gates"]])
    out_edges = [(e, outside_len(D, e["pts"])) for e in gb.edges]
    out_edges = [(round(o, 1), i) for i, (e, o) in enumerate(out_edges) if o > 0.5]
    print("仍有 %d 条边越界（>0.5 m）：%s" % (len(out_edges), sorted(out_edges, reverse=True)[:6]))

    bmap = {b.get("id"): b for b in D["buildings"]}
    for pl in D.get("places") or []:
        if pl.get("kind") == "building":
            b = bmap.get(pl.get("ref"))
            if b is None:
                continue
            pl["node"] = b.get("node")
            if b.get("access"):
                # 门口可能换到楼体另一侧，place 的 x/z 要跟着挪，否则前端会从
                # 旧门点画一条横穿楼体的接入直线
                pl["x"], pl["z"] = b["access"][0], b["access"][1]
        elif pl.get("kind") == "gate":
            for g in D["gates"]:
                if (g.get("name") or "") == pl.get("ref") and g.get("node") is not None:
                    pl["node"] = g["node"]
                    pl["x"], pl["z"] = g["x"], g["z"]
                    break
    nonode = [pl.get("label") or pl.get("ref") for pl in D.get("places") or []
              if pl.get("node") is None]
    print("places 无节点 %d 个：%s" % (len(nonode), nonode[:8]))
    bad = [(pl.get("label"), pl.get("node")) for pl in D.get("places") or []
           if not isinstance(pl.get("node"), int) or not 0 <= pl["node"] < len(gb.nodes)]
    print("places 节点越界 %d 个：%s" % (len(bad), bad[:8]))

    plot_compare(D, old_graph, new_graph, os.path.join(OUT, "north_compare.png"))

    if args.write:
        D["graph"] = new_graph
        text = head + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + tail
        with open(DATA, "w", encoding="utf-8", newline="") as f:
            f.write(text)
        print("已写回 %s（%.1f KB）" % (DATA, len(text.encode("utf-8")) / 1024))
    else:
        print("（预演，未写入；加 --write 写回）")


if __name__ == "__main__":
    main()
