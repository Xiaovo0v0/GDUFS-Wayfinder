# -*- coding: utf-8 -*-
"""把北校区（白云山校区）从「栅格贴图」升级成「矢量数据」。

输入：
  artifacts/north/roads_vec.json   由 tools/vectorize_north_roads.py 生成的道路中心线
  gdufs-3d/assets/north-river.png  相思河栅格掩膜
  gdufs-3d/north-data.js           原始数据（只保留 buildings/boundary/gates/places/meta）

输出：
  gdufs-3d/north-data.js           写回 roads / waterPolygons / graph / layers
  artifacts/north/north_plan.png   矢量化结果对照图

用法：
  python tools/build_north_data.py            # 只生成对照图
  python tools/build_north_data.py --write    # 写回 north-data.js
"""
import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image
from shapely.geometry import LineString, MultiPolygon, Point, Polygon
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rebuild_roads import build_graph, DOOR_MAX  # noqa: E402  复用南校的导航图构建

DATA = "gdufs-3d/north-data.js"
VEC = "artifacts/north/roads_vec.json"
RIVER = "gdufs-3d/assets/north-river.png"
OUT_DIR = "artifacts/north"
S = 0.4178
X0, Z0 = 628.4, 503.7


def load_data(path=DATA):
    s = io.open(path, encoding="utf-8").read()
    i, j = s.index("{"), s.rindex("}")
    return json.loads(s[i:j + 1]), s[:i], s[j + 1:]


def to_world(px, py):
    return (X0 - (px + 0.5) * S, Z0 - (py + 0.5) * S)


def river_polygons(D=None):
    """栅格河面 -> 矢量多边形。

    官方平面图里的相思河其实是一条带桥洞断口的**描线**，不是面。
    直接按 alpha 提等值线会得到一串互不相连的短块（看着像河被切成几截）。
    所以先细化成中心线、把断口接起来，再按实测宽度缓冲成连续的面。
    """
    from skimage.morphology import skeletonize
    from skimage.graph import pixel_graph  # noqa: F401  (仅为兼容旧版 skimage)
    from skan import Skeleton
    from scipy import ndimage

    a = np.array(Image.open(RIVER).convert("RGBA"))
    mask = a[:, :, 3] > 128
    dist = ndimage.distance_transform_edt(mask)
    skel = skeletonize(mask)
    sk = Skeleton(skel, source_image=mask)

    paths = []
    for i in range(sk.n_paths):
        ys, xs = sk.path_coordinates(i).T
        pts = [to_world(float(x), float(y)) for x, y in zip(xs, ys)]
        if len(pts) < 2:
            continue
        w = [2.0 * float(dist[int(y), int(x)]) * S for x, y in zip(xs, ys)]
        w.sort()
        paths.append({"pts": pts, "w": w[len(w) // 2] if w else 4.0})

    # 把断口（桥）接起来：端点相距 30 m 以内的两条线并成一条
    JOIN = 30.0
    changed = True
    while changed and len(paths) > 1:
        changed = False
        for i in range(len(paths)):
            for j in range(i + 1, len(paths)):
                a1, b1 = paths[i]["pts"], paths[j]["pts"]
                cand = [
                    (math.dist(a1[0], b1[0]), "hh"),
                    (math.dist(a1[0], b1[-1]), "ht"),
                    (math.dist(a1[-1], b1[0]), "th"),
                    (math.dist(a1[-1], b1[-1]), "tt"),
                ]
                d, how = min(cand)
                if d > JOIN:
                    continue
                if how == "hh":
                    merged = a1[::-1] + b1
                elif how == "ht":
                    merged = a1[::-1] + b1[::-1]
                elif how == "th":
                    merged = a1 + b1
                else:
                    merged = a1 + b1[::-1]
                w = (paths[i]["w"] + paths[j]["w"]) / 2.0
                paths[i] = {"pts": merged, "w": w}
                paths.pop(j)
                changed = True
                break
            if changed:
                break

    bnd = None
    if D is not None:
        bnd = unary_union([Polygon(r) for r in D["boundary"] if len(r) >= 4])

    polys = []
    for p in paths:
        if len(p["pts"]) < 2:
            continue
        half = max(2.0, min(p["w"] / 2.0, 9.0))
        g = LineString(p["pts"]).buffer(half, cap_style=2, join_style=1)
        if not g.is_empty:
            polys.append(g)
    if not polys:
        return []
    u = unary_union(polys)
    if isinstance(u, Polygon):
        u = MultiPolygon([u])
    # 只保留到边界外 6 m：河在围墙处「流出去」就够了。
    # 试过往外补等宽/收窄的尾巴，但中心线末段方向不可靠，会画出一根横插进草地的蓝棒子，观感更差。
    if bnd is not None:
        u = u.intersection(bnd.buffer(6.0))
        if isinstance(u, Polygon):
            u = MultiPolygon([u])
    out = []
    for p in u.geoms:
        p = p.simplify(0.8, preserve_topology=True)
        if p.area < 30:
            continue
        out.append([[round(c[0], 1), round(c[1], 1)] for c in p.exterior.coords])
    out.sort(key=lambda r: -abs(_area(r)))
    return out


def _area(ring):
    s = 0.0
    for i in range(len(ring) - 1):
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return s / 2.0


def _stadium(cx, cz, width, length, n=96):
    """两端半圆的跑道形（操场外圈/内场）。width 沿 x，length 沿 z。"""
    r = width / 2.0
    half = max(length / 2.0 - r, 0.0)
    pts = []
    for i in range(n + 1):
        a = math.pi * i / n
        pts.append((cx + r * math.cos(a), cz - half - r * math.sin(a)))
    for i in range(n + 1):
        a = math.pi * i / n
        pts.append((cx - r * math.cos(a), cz + half + r * math.sin(a)))
    pts.append(pts[0])
    return [[round(p[0], 2), round(p[1], 2)] for p in pts]


def sports_field():
    """北校区操场：中心 (-39.9, 61.4)，跑道外圈 108 m x 200 m（实测自 b.jpg）。

    输出结构与 app.js 里已有的 `l.sport === "running"` 分支一致：
    rings[0] 是跑道外圈，rings[1] 是内场草地，渲染时会自动铺红色胶面 + 白线 + 足球场标线。
    """
    cx, cz = -39.9, 61.4
    return {
        "name": "操场",
        "kind": "track",
        "water": False,
        "pitch": True,
        "sport": "running",
        "source": "官方平面图 b.jpg 矢量化",
        "rings": [_stadium(cx, cz, 108.0, 200.0), _stadium(cx, cz, 89.0, 181.0)],
    }


def derive_boundary(D, roads, field, keep=26.0, ratio=0.22, smooth=8.0, simplify=2.5):
    """用校园实际内容的凹包求边界，替代原来的六边形粗描。

    凹包只取「建筑 ∪ 操场」（紧凑、贴合建筑群），再把核心区附近的道路并进来，
    远离建筑群的城市道路支线（通往机场路/荷塘路之类）不会被拉进边界。
    """
    from shapely import concave_hull
    from shapely.ops import unary_union

    shapes = []
    for b in D["buildings"]:
        for ring in b.get("rings") or []:
            if len(ring) >= 4:
                p = Polygon(ring).buffer(0)
                if not p.is_empty:
                    shapes.append(p)
    shapes.append(Polygon(field["rings"][0]).buffer(0))
    core = concave_hull(unary_union(shapes), ratio=ratio).buffer(keep, join_style=1)
    roadp = unary_union([LineString(r["lines"][0]).buffer(7.0) for r in roads
                         if len(r["lines"][0]) >= 2])
    poly = unary_union([core, roadp.intersection(core.buffer(40.0))])
    poly = poly.buffer(-smooth, join_style=1).buffer(0)
    if poly.geom_type == "MultiPolygon":
        poly = max(poly.geoms, key=lambda g: g.area)
    poly = poly.simplify(simplify, preserve_topology=True)
    return [[[round(x, 2), round(z, 2)] for x, z in poly.exterior.coords]]


def main():
    write = "--write" in sys.argv
    D, head, tail = load_data()
    roads = json.load(io.open(VEC, encoding="utf-8"))

    # 操场：官方平面图上有红色跑道 + 绿色内场，north-data 里完全没有
    field = sports_field()
    D["landscape"] = [field]

    # 去掉过短/退化的碎段；同一位置重复描线的去重
    clean = []
    for r in roads:
        pts = r["lines"][0]
        if len(pts) < 2 or r["len"] < 8:
            continue
        clean.append(r)
    print("roads", len(clean), "total %.0f m" % sum(r["len"] for r in clean))

    # 边界：官方数据里的六边形粗描，面积 56.7 万 m2，比真实校园大 2 倍多。
    # 改用「建筑 ∪ 道路 ∪ 河 ∪ 操场」的凹包外扩，形状跟着实际建筑群走。
    if "--keep-boundary" not in sys.argv:
        rings = derive_boundary(D, clean, field)
        if rings:
            old_area = sum(abs(_area(r)) for r in D.get("boundary") or [])
            new_area = sum(abs(_area(r)) for r in rings)
            D["boundary"] = rings
            print("boundary derived: %d ring(s), %.0f -> %.0f m2"
                  % (len(rings), old_area, new_area))

    # 裁到校区边界外 30 m：保留贴边而过的外环东路/中环路，但去掉更远的城市道路
    bnd = unary_union([Polygon(r) for r in D["boundary"] if len(r) >= 4]).buffer(30.0)
    clipped = []
    for r in clean:
        g = LineString(r["lines"][0]).intersection(bnd)
        parts = []
        if g.is_empty:
            continue
        if g.geom_type == "LineString":
            parts = [g]
        elif hasattr(g, "geoms"):
            parts = [x for x in g.geoms if x.geom_type == "LineString"]
        for p in parts:
            if p.length < 8:
                continue
            clipped.append({
                "name": r.get("name") or "",
                "highway": r["highway"],
                "width": r["width"],
                "len": p.length,
                "lines": [[[round(c[0], 2), round(c[1], 2)] for c in p.coords]],
            })
    clean = clipped
    print("roads after clip", len(clean), "total %.0f m" % sum(r["len"] for r in clean))

    water = river_polygons(D)
    print("water polygons", len(water), "area %.0f m2" % sum(abs(_area(w)) for w in water))

    new_roads = []
    for r in clean:
        new_roads.append({
            "name": "",
            "highway": r["highway"],
            "width": r["width"],
            "lines": r["lines"],
        })

    # 官方图层没有步行小径，宿舍区补一套（见 tools/synth_north_footpaths.py）
    from synth_north_footpaths import synthesize
    foot = synthesize(D, new_roads)
    print("footpaths %d total %.0f m" % (len(foot), sum(
        sum(math.hypot(ln[k][0] - ln[k - 1][0], ln[k][1] - ln[k - 1][1])
            for k in range(1, len(ln))) for f in foot for ln in f["lines"])))
    new_roads += foot

    D["roads"] = new_roads
    # 校门必须落在边界上：官方数据里南门偏出边界 45 m，绿篱开口和门对不上。
    # 只在门跑到边界外面时才挪；本来就在校内的门（正门、北门是退线布置）不动。
    bp = unary_union([Polygon(r) for r in D["boundary"] if len(r) >= 4])
    rings = [bp] if bp.geom_type == "Polygon" else list(bp.geoms)
    for g in D.get("gates") or []:
        p = Point(g["x"], g["z"])
        if bp.contains(p):
            continue
        best, best_d = None, 1e9
        for poly in rings:
            d = poly.exterior.distance(p)
            if d < best_d:
                best, best_d = poly.exterior, d
        if best is not None and best_d > 3.0:
            q = best.interpolate(best.project(p))
            print("snap gate %.1f,%.1f -> %.1f,%.1f (moved %.1f m)"
                  % (g["x"], g["z"], q.x, q.y, best_d))
            g["x"], g["z"] = round(q.x, 1), round(q.y, 1)
    # app.js 里 waterPolygons 的每项是 {name, rings:[[...]]}，不是裸环
    D["waterPolygons"] = [{"name": "相思河", "rings": [w]} for w in water]
    D["water"] = []
    # 矢量数据接管后不再叠栅格图层，避免双重描线
    D.pop("layers", None)

    # 北校 highway 是按路宽猜的（14.6 m 的 secondary 其实是校内主路），不能套南校
    # 「城市道路整条剔除」的口径，只能靠「裁剪到校区多边形以内」保证不出校。
    # 2026-11-01 起 build_graph 的 inner_m 外扩被去掉（那正是路线跑到围墙外的根源）。
    gb, repaired, comp, off_b, off_g = build_graph(
        D, new_roads, door_max=DOOR_MAX, city_roads=set())
    D["graph"] = {
        "nodes": [[round(p[0], 1), round(p[1], 1)] for p in gb.nodes],
        "edges": gb.edges,
    }
    # places 里的建筑/校门引用同步到新节点
    # 北校 places 用的是旧字段（building/type/access），app.js 认的是 kind+ref：
    # 不统一的话点建筑会报「该建筑未命名，无法作为导航点」，校门也不在下拉框里。
    bmap = {b.get("id"): b for b in D["buildings"]}
    for pl in D.get("places") or []:
        bid = pl.pop("building", None)
        if bid and not pl.get("ref"):
            pl["kind"] = "building"
            pl["ref"] = bid
        b = bmap.get(pl.get("ref"))
        if b is not None:
            pl["x"], pl["z"] = b["centroid"][0], b["centroid"][1]
            if b.get("node") is not None:
                pl["node"] = b["node"]
            pl["type"] = pl.get("type") or b.get("type")
    have = set(p.get("label") for p in D.get("places") or [])
    for g in D["gates"]:
        nm = (g.get("name") or "").strip()
        if not nm or nm in have:
            continue
        D["places"].append({
            "label": nm, "x": g["x"], "z": g["z"],
            "kind": "gate", "ref": nm, "node": g.get("node"),
        })
        have.add(nm)
    print("places %d (含校门 %d)" % (len(D["places"]),
                                     sum(1 for p in D["places"] if p.get("kind") == "gate")))
    print("graph nodes %d edges %d comps %d (main %d) repaired %d"
          % (len(gb.nodes), len(gb.edges), len(comp), comp.most_common(1)[0][1], repaired))
    print("off-main buildings %d gates %d" % (len(off_b), len(off_g)))

    if write:
        bak = DATA + ".before-vector"
        if not os.path.exists(bak):
            io.open(bak, "w", encoding="utf-8", newline="").write(head + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + tail)
        txt = head + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + tail
        io.open(DATA, "w", encoding="utf-8", newline="").write(txt)
        print("wrote", DATA, "%.1f KB" % (len(txt.encode("utf-8")) / 1024.0))

    plot(D)


def plot(D):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as MPoly

    os.makedirs(OUT_DIR, exist_ok=True)
    fig, ax = plt.subplots(figsize=(11, 11), dpi=110)
    for ring in D["boundary"]:
        ax.add_patch(MPoly(ring, closed=True, facecolor="#e8efe0", edgecolor="#3a6b34", lw=1.6, zorder=1))
    for b in D["buildings"]:
        for ring in b["rings"]:
            ax.add_patch(MPoly(ring, closed=True, facecolor="#b8b8b8", edgecolor="#8a8a8a", lw=0.4, zorder=3))
    for w in D.get("waterPolygons") or []:
        for ring in w.get("rings", []):
            ax.add_patch(MPoly(ring, closed=True, facecolor="#9ed0e6", edgecolor="#6fb4d6", lw=0.6, zorder=2))
    CM = {"secondary": "#d94f4f", "tertiary": "#e0a020", "service": "#4f8fd9", "footway": "#3fa03f"}
    for r in D["roads"]:
        for ln in r["lines"]:
            xs = [p[0] for p in ln]
            zs = [p[1] for p in ln]
            ax.plot(xs, zs, color=CM.get(r["highway"], "#888"), lw=1.2, zorder=4)
    for g in D["gates"]:
        ax.plot(g["x"], g["z"], "o", color="#c0392b", ms=7, zorder=6)
        ax.text(g["x"], g["z"] + 12, g.get("name", ""), fontsize=8, ha="center", zorder=7)
    ax.set_aspect("equal")
    ax.set_title("north campus: vector roads / water / boundary")
    ax.grid(alpha=0.25)
    fig.tight_layout()
    p = os.path.join(OUT_DIR, "north_plan.png")
    fig.savefig(p)
    plt.close(fig)
    print("wrote", p)


if __name__ == "__main__":
    main()
