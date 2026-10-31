# -*- coding: utf-8 -*-
"""把「校门 → 图书馆」的步行路线画出来，红色标出跑出校区的部分。"""
import heapq
import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "gdufs-3d", "gdufs-data.js")
OUT = os.path.join(ROOT, "artifacts", "roads", "routes.png")


def load():
    text = open(SRC, encoding="utf-8").read()
    i = text.index("{")
    obj, _ = json.JSONDecoder().raw_decode(text[i:])
    return obj


def main():
    D = load()
    polys = []
    for r in D["boundary"]:
        p = Polygon(r)
        if not p.is_valid:
            p = p.buffer(0)
        polys.append(p)
    poly = unary_union(polys)

    nodes = D["graph"]["nodes"]
    edges = D["graph"]["edges"]
    adj = {}
    for e in edges:
        w = e.get("w") or LineString([nodes[e["a"]], nodes[e["b"]]]).length
        adj.setdefault(e["a"], []).append((e["b"], w))
        adj.setdefault(e["b"], []).append((e["a"], w))

    lib = None
    for b in D["buildings"]:
        if "图书馆" in (b.get("name") or ""):
            ring = b["rings"][0]
            lib = [sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)]
            break
    lib_i = min(range(len(nodes)), key=lambda i: (nodes[i][0] - lib[0]) ** 2 + (nodes[i][1] - lib[1]) ** 2)

    dist = {lib_i: 0.0}
    prev = {}
    pq = [(0.0, lib_i)]
    while pq:
        du, u = heapq.heappop(pq)
        if du > dist.get(u, 1e18):
            continue
        for v, w in adj.get(u, []):
            nd = du + w
            if nd < dist.get(v, 1e18):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))

    fig, ax = plt.subplots(figsize=(11, 13))
    for p in polys:
        xs, ys = p.exterior.xy
        ax.fill(xs, ys, color="#eef6e8", zorder=0)
        ax.plot(xs, ys, color="green", ls="--", lw=1.0, zorder=1)
    for rd in D["roads"]:
        for ln in rd.get("lines", []):
            xs = [p[0] for p in ln]
            ys = [p[1] for p in ln]
            ax.plot(xs, ys, color="#8a8f99", lw=0.8, zorder=2)

    for g in D["gates"]:
        nid = g.get("node")
        if nid is None or nid not in dist:
            continue
        path = [nid]
        while path[-1] != lib_i:
            path.append(prev[path[-1]])
        path.reverse()
        ls = LineString([nodes[i] for i in path])
        xs, ys = ls.xy
        ax.plot(xs, ys, color="#1f6fd0", lw=2.0, zorder=4)
        out = ls.difference(poly)
        if not out.is_empty:
            geoms = [out] if out.geom_type == "LineString" else list(getattr(out, "geoms", []))
            for seg in geoms:
                if seg.geom_type == "LineString" and seg.length > 1:
                    ax.plot(*seg.xy, color="red", lw=3.0, zorder=5)
        ax.plot([nodes[nid][0]], [nodes[nid][1]], "o", color="#d95f02", ms=6, zorder=6)
        ax.annotate(g.get("name") or "?", (nodes[nid][0], nodes[nid][1]), fontsize=8,
                    color="#8a3b00", zorder=7)
    ax.set_aspect("equal")
    ax.set_title("gate -> library routes (red = outside campus)")
    fig.tight_layout()
    fig.savefig(OUT, dpi=110)
    print("→", OUT)


if __name__ == "__main__":
    main()
