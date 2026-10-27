# -*- coding: utf-8 -*-
"""裁剪后复验：外环覆盖是否仍完整；从各校门走到图书馆，路线会不会跑出校区。"""
import heapq
import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "gdufs-3d", "gdufs-data.js")
OUT = os.path.join(ROOT, "artifacts", "roads")


def load():
    text = open(SRC, encoding="utf-8").read()
    i = text.index("{")
    obj, _ = json.JSONDecoder().raw_decode(text[i:])
    return obj


def main():
    D = load()
    poly = unary_union([Polygon(r).buffer(0) if not Polygon(r).is_valid else Polygon(r)
                        for r in D["boundary"]])

    roads = unary_union([LineString(ln) for rd in D["roads"] for ln in rd.get("lines", [])])
    rings = []
    for g in getattr(poly, "geoms", [poly]):
        rings.append(g.exterior)
        rings.extend(g.interiors)
    step = 5.0
    for k, ring in enumerate(rings):
        n = int(ring.length // step)
        d = [ring.interpolate(i * step).distance(roads) for i in range(n)]
        cov = sum(1 for x in d if x <= 12.0) / float(n)
        gaps = [i for i, x in enumerate(d) if x > 12.0]
        print("环 %d 周长 %.0f m 覆盖 %.1f%%（中位 %.1f m，最大 %.1f m，缺口点 %d）" % (
            k, ring.length, 100 * cov, sorted(d)[n // 2], max(d), len(gaps)))

    # 图
    nodes = D["graph"]["nodes"]
    edges = D["graph"]["edges"]
    adj = {}
    for e in edges:
        w = e.get("w") or e.get("weight") or LineString([nodes[e["a"]], nodes[e["b"]]]).length
        adj.setdefault(e["a"], []).append((e["b"], w))
        adj.setdefault(e["b"], []).append((e["a"], w))

    # 图书馆节点：找最近的图节点
    lib = None
    for b in D["buildings"]:
        if "图书馆" in (b.get("name") or ""):
            ring = b["rings"][0]
            lib = [sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)]
            break
    if lib is None:
        print("找不到图书馆")
        return
    lib_i = min(range(len(nodes)), key=lambda i: (nodes[i][0] - lib[0]) ** 2 + (nodes[i][1] - lib[1]) ** 2)
    print("图书馆中心", lib, "→ 最近图节点", lib_i, nodes[lib_i])

    def dijkstra(src):
        dist = {src: 0.0}
        prev = {}
        pq = [(0.0, src)]
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
        return dist, prev

    dist, prev = dijkstra(lib_i)
    for g in D["gates"]:
        nid = g.get("node")
        if nid is None or nid not in dist:
            continue
        path = [nid]
        while path[-1] != lib_i:
            path.append(prev[path[-1]])
        path.reverse()
        coords = [nodes[i] for i in path]
        ls = LineString(coords)
        out = ls.difference(poly)
        print("  %-22s 距离 %6.0f m  路点 %2d  出界 %.1f m" % (
            g.get("name") or g.get("entrance") or "?", dist[nid], len(path), out.length))


if __name__ == "__main__":
    main()
