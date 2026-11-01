# -*- coding: utf-8 -*-
"""只重建南校导航图（graph + 建筑/校门/地点 node），不动道路几何。

背景
----
2026-11 人工测试：起点「北苑1栋」、终点「学生活动中心」，路线跑到了围墙外的
大学城广外西路上。原因是 `rebuild_roads.build_graph` 用 `boundary.buffer(6)` 当
保留区——外环路就贴着围墙走，6 m 外扩正好把它整段放进导航图；而北苑1栋的门点
落在临街那一面，离校外马路只有 4–9 m，于是「出门→上校外路→沿校外路南下→
从 3 号门回校内」。

修法
----
1. 城市道路（primary/secondary/tertiary + link）整条剔除，其余道路只留校区
   多边形**以内**的部分；地下隧道整条保留（两片校区之间唯一的步行通道）。
2. 建筑门口从「OSM 门点 + 外墙顶点」里挑：接驳线不许出界、不许穿别的楼、
   不许钻进自己楼体，平手时保留 OSM 门点。北苑1栋这类临街楼会自动改到朝
   校区那一侧的门口。

用法
----
    python tools/rebuild_nav_graph.py            # 预演：统计 + 对照图
    python tools/rebuild_nav_graph.py --write    # 写回 gdufs-3d/gdufs-data.js
"""
import argparse
import json
import math
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
DATA = os.path.join(ROOT, "gdufs-3d", "gdufs-data.js")
OUT = os.path.join(ROOT, "artifacts", "nav")
os.makedirs(OUT, exist_ok=True)


def plot_compare(D, old_graph, new_graph, path):
    import matplotlib
    matplotlib.rcParams["font.family"] = ["Microsoft YaHei", "SimHei", "DejaVu Sans"]
    matplotlib.rcParams["axes.unicode_minus"] = False
    zones = [Polygon(r) for r in D["boundary"]]
    fig, axes = plt.subplots(1, 2, figsize=(17, 11), dpi=100)
    for ax, graph, title in ((axes[0], old_graph, "before (校外道路混进导航图)"),
                             (axes[1], new_graph, "after (只走校内道路)")):
        for z in zones:
            ax.add_patch(MPoly(list(z.exterior.coords), closed=True, fill=True,
                               facecolor="#f2f5ec", edgecolor="#2e7d32", lw=1.2, ls="--", zorder=0))
        nodes = graph.get("nodes") or []
        for e in graph.get("edges") or []:
            pts = e.get("pts") or []
            if len(pts) < 2:
                continue
            color = "#c62828" if e.get("connector") else "#1565c0"
            if e.get("connector"):
                lw = 1.0
                style = ":"
            else:
                lw = 1.6
                style = "-"
            ax.plot([p[0] for p in pts], [p[1] for p in pts], style, color=color, lw=lw, zorder=3)
        for g in D["gates"]:
            if "x" not in g:
                continue
            ax.plot(g["x"], g["z"], "s", color="#e65100", ms=5, zorder=6)
            ax.annotate(g.get("name") or "", (g["x"], g["z"]), fontsize=6, color="#e65100")
        ax.set_aspect("equal")
        ax.grid(alpha=0.15)
        ax.set_title(title)
        ax.set_xlim(-500, 340)
        ax.set_ylim(-840, 140)
    fig.tight_layout()
    fig.savefig(path)
    print("对照图 →", path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--join", type=float, default=30.0)
    ap.add_argument("--door", type=float, default=R.DOOR_MAX)
    args = ap.parse_args()

    D, head, tail = R.load_data()
    old_graph = json.loads(json.dumps({"nodes": (D.get("graph") or {}).get("nodes", []),
                                       "edges": (D.get("graph") or {}).get("edges", [])}))
    old_nodes = [(b.get("name"), b.get("node"), b.get("access_dist")) for b in D["buildings"]]
    old_access = {b.get("id"): (list(b.get("access") or [])) for b in D["buildings"]}

    city_km = sum(R.poly_len(ln) for r in D["roads"] if r.get("highway") in R.CITY_ROAD
                  for ln in r["lines"]) / 1000.0
    gb, repaired, comp, off_b, off_g = R.build_graph(D, D["roads"], join_max=args.join,
                                                     door_max=args.door)
    new_graph = {"nodes": gb.nodes, "edges": gb.edges}

    city_edges = sum(1 for e in old_graph["edges"] if not e.get("connector"))
    print("城市道路总长 %.2f km（整条剔除）" % city_km)
    print("导航图：节点 %d，边 %d（旧 %d/%d），连通分量 %d，缝合边 %d"
          % (len(gb.nodes), len(gb.edges), len(old_graph["nodes"]), len(old_graph["edges"]),
             len(comp), repaired))
    print("脱离主分量的建筑 %d 个：%s" % (len(off_b), off_b[:8]))
    print("脱离主分量的校门 %d 个：%s" % (len(off_g), off_g[:8]))

    moved = [b["name"] for b in D["buildings"]
             if b.get("name") and b.get("entrance_osm")
             and (abs(b["access"][0] - b["entrance_osm"][0]) > 0.5
                  or abs(b["access"][1] - b["entrance_osm"][1]) > 0.5)]
    print("门点仍在校区一侧（非 OSM 原门点）的建筑 %d 个：%s" % (len(moved), moved))
    changed = [b["name"] for b in D["buildings"]
               if b.get("name") and old_access.get(b.get("id"))
               and b.get("access")
               and (abs(b["access"][0] - old_access[b["id"]][0]) > 0.5
                    or abs(b["access"][1] - old_access[b["id"]][1]) > 0.5)]
    print("本次相对上次写回发生变动的门点 %d 个：%s" % (len(changed), changed))
    far = sorted([(b.get("access_dist"), b["name"]) for b in D["buildings"] if b.get("name")],
                 key=lambda t: -(t[0] or 0))
    print("接驳距离最远 8 个：%s" % far[:8])
    gfar = sorted([(g.get("access_dist"), g.get("name")) for g in D["gates"] if "x" in g],
                  key=lambda t: -(t[0] or 0))
    print("校门接驳：%s" % gfar)

    # places 节点同步
    for pl in D.get("places") or []:
        ref = pl.get("ref")
        if pl.get("kind") == "building":
            for b in D["buildings"]:
                if b.get("id") == ref and b.get("node") is not None:
                    pl["node"] = b["node"]
                    # 门点若挪到校区一侧，place 的 x/z 必须跟着挪，
                    # 否则前端会从旧门点画一条横穿楼体/草坪的接入直线
                    if b.get("access"):
                        pl["x"], pl["z"] = b["access"][0], b["access"][1]
                    break
        elif pl.get("kind") == "gate":
            # 校门 place 的 ref 是人工别名（如「主校门（正门）」「西南门」），和 gates.name
            # 对不上；按坐标就近认领，认不到再退回名字比对。历史数据里这几个 place 的
            # node 是旧图遗留的野值（正门 218 / 3号门 219），比 node 总数还大。
            best = None
            for g in D["gates"]:
                if g.get("node") is None or "x" not in g:
                    continue
                d = ((g["x"] - pl.get("x", 1e9)) ** 2 + (g["z"] - pl.get("z", 1e9)) ** 2) ** 0.5
                if best is None or d < best[0]:
                    best = (d, g)
            if best and best[0] <= 1.0:
                pl["node"] = best[1]["node"]
                pl["x"], pl["z"] = best[1]["x"], best[1]["z"]
            else:
                for g in D["gates"]:
                    if (g.get("name") or "") == ref and g.get("node") is not None:
                        pl["node"] = g["node"]
                        break
    nonode = [pl.get("name") or pl.get("label") or pl.get("ref")
              for pl in D.get("places") or [] if pl.get("node") is None]
    print("places 无节点 %d 个：%s" % (len(nonode), nonode[:8]))
    bad = [(pl.get("label"), pl.get("node")) for pl in D.get("places") or []
           if not isinstance(pl.get("node"), int) or not 0 <= pl["node"] < len(gb.nodes)]
    print("places 节点越界 %d 个：%s" % (len(bad), bad[:8]))

    plot_compare(D, old_graph, new_graph, os.path.join(OUT, "compare.png"))

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
