# -*- coding: utf-8 -*-
"""路口交汇面（junction surface）离线构建。

为什么要有这一步
----------------
路面是「每条路一条 ribbon」画出来的，两条路在路口一定重叠。重叠区里两层
路面同高、深度值完全相同，GPU 逐像素随机选谁赢 —— 这就是用户看到的
「道路交界处图层重叠」。之前用 polygonOffset 让高等级路压住低等级路，
只是让斑纹看不见，路口本身仍然是「两条路压在一起」，不是「一个路口」。

这里的做法：把路口当成独立的几何体。
  1. 每条车行道按渲染用的真实宽度 buffer 成面（斜接、平头、端头补 cap）；
  2. 两两求交，相交面积 > 阈值的记一对；
  3. 把**空间上挨在一起的相交面**归成一个路口（不是按线段连通聚类，
     否则一条主干道会把十几个路口串成一大坨）；
  4. 对路口里每条臂，沿中心线从核心向外走，找到「离开其它臂路面」的位置，
     取该处中心 ± 法向*半宽两个点 —— 这是路口的「嘴」；
  5. 所有嘴点取凸包 ∪ 两两相交面 → 路口多边形（十字/丁字/斜交都能盖满）；
  6. 凸包 ∩（各臂路面并集外扩 2.5 m），防止浅角度交叉时把沥青涂到草地上；
  7. 圆角（buffer +0.6 / -0.33）+ simplify → 带切角的路口面。

渲染端（gdufs-3d/app.js 的 renderJunctions）把它画在路面之上，于是穿过路口的
中心线/双黄线被自然切断 —— 真实路口就是这样；再在主要臂上加停止线与斑马线。

用法：
    python tools/build_junctions.py                 # 南校区，只统计 + 出图
    python tools/build_junctions.py --write         # 写回 gdufs-3d/gdufs-data.js
    python tools/build_junctions.py --campus north --write
"""
import json
import math
import os
import sys

from shapely.geometry import LineString, Point, Polygon, MultiPoint
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOUTH = os.path.join(ROOT, "gdufs-3d", "gdufs-data.js")
NORTH = os.path.join(ROOT, "gdufs-3d", "north-data.js")

# —— 与 app.js 完全一致的宽度表 ——
ROAD_W = {
    "primary": 7, "secondary": 6, "tertiary": 5, "residential": 4.5,
    "service": 3.5, "track": 3, "unclassified": 4, "living_street": 3.5,
    "trunk": 7.5, "motorway": 8,
}
PATH_W = {
    "footway": 2.2, "path": 1.9, "steps": 2.2, "pedestrian": 3.0,
    "cycleway": 2.2, "corridor": 1.8, "elevator": 1.8,
}
WALK_KIND = {k: 1 for k in PATH_W}
MAIN_ROAD = {"primary": 1, "primary_link": 1, "secondary": 1,
             "secondary_link": 1, "tertiary": 1, "trunk": 1, "motorway": 1}

MIN_AREA = 3.0        # 两臂相交面积（m2）超过这个才算路口
STEP = 0.5            # 沿中心线找「嘴」的采样步长（m）
CLIP_OUT = 0.45       # 凸包裁剪：允许超出路面的最大距离（m）
ROUND = 0.6           # 圆角半径（m）
SIMPLIFY = 0.35


# ------------------------------------------------------------------ IO
def load_data(path):
    text = open(path, encoding="utf-8").read()
    i = text.index("{")
    obj, _ = json.JSONDecoder().raw_decode(text[i:])
    tail = text[i + len(json.dumps(obj, ensure_ascii=False)):]
    return obj, text[:i], tail


def save_data(path, D, head, tail):
    if not tail.strip().startswith(";"):
        tail = ";" + tail
    text = head + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + tail
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("已写回 %s（%.1f KB）" % (path, len(text.encode("utf-8")) / 1024.0))


# ------------------------------------------------------------------ 几何
def road_half_width(r):
    lv = r.get("highway") or "service"
    walk = lv in WALK_KIND
    if walk:
        w = PATH_W.get(lv, 2.0)
        if r.get("width") and r["width"] > 1.5:
            w = min(r["width"], 7.0)
    else:
        w = ROAD_W.get(lv, 3.5)
        if r.get("width") and r["width"] > 2.5:
            w = max(3.0, min(r["width"], 13.0))
    return w / 2.0, walk, w


def extend_ends(pts, cap):
    """和 app.js 的 ribbonGeometry 第 5 参一致：首尾沿切线各延长 cap 米。"""
    if cap <= 1e-6 or len(pts) < 2:
        return [list(p) for p in pts]
    p0, p1 = pts[0], pts[1]
    L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]) or 1.0
    a = [p0[0] - (p1[0] - p0[0]) / L * cap, p0[1] - (p1[1] - p0[1]) / L * cap]
    q0, q1 = pts[-2], pts[-1]
    L2 = math.hypot(q1[0] - q0[0], q1[1] - q0[1]) or 1.0
    b = [q1[0] + (q1[0] - q0[0]) / L2 * cap, q1[1] + (q1[1] - q0[1]) / L2 * cap]
    return [a] + [list(p) for p in pts] + [b]


def ribbon_poly(pts, hw, cap):
    ext = extend_ends(pts, cap)
    line = LineString(ext)
    if line.length < 1e-6:
        return None, None
    poly = line.buffer(hw, cap_style=2, join_style=2, mitre_limit=2.2, resolution=4)
    if poly.is_empty:
        return None, None
    if poly.geom_type == "MultiPolygon":
        poly = max(poly.geoms, key=lambda g: g.area)
    return line, poly


def collect_segments(D):
    segs = []
    for ri, r in enumerate(D.get("roads") or []):
        if r.get("tunnel"):
            continue
        hw, walk, w = road_half_width(r)
        if walk:
            continue  # 步行道不参与车行路口
        lv = r.get("highway") or "service"
        for li, pts in enumerate(r.get("lines") or []):
            if len(pts) < 2:
                continue
            line, poly = ribbon_poly(pts, hw, w / 2.0)
            if poly is None or poly.area < 1.0:
                continue
            segs.append({
                "ri": ri, "li": li, "r": r, "level": lv, "hw": hw, "w": w,
                "line": line, "poly": poly,
                "main": 1 if lv in MAIN_ROAD else 0,
            })
    return segs


def find_clusters(segs):
    """按「相交面」聚类，而不是按「线段」聚类。

    按线段连通聚类会把整张路网并成一个大簇（一条主干道依次穿过十几个路口）。
    路口是局部的东西，所以先算出所有两两相交面，再把**空间上挨在一起的
    相交面**归成一个路口。
    """
    n = len(segs)
    inter = []
    for i in range(n):
        pi = segs[i]["poly"]
        minx, miny, maxx, maxy = pi.bounds
        for j in range(i + 1, n):
            if segs[i]["ri"] == segs[j]["ri"]:
                continue
            pj = segs[j]["poly"]
            if pj.bounds[0] > maxx or pj.bounds[2] < minx:
                continue
            if pj.bounds[1] > maxy or pj.bounds[3] < miny:
                continue
            a = pi.intersection(pj)
            if a.is_empty or a.area < MIN_AREA:
                continue
            inter.append((i, j, a))

    m = len(inter)
    parent = list(range(m))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for a in range(m):
        pa = inter[a][2]
        for b in range(a + 1, m):
            if pa.distance(inter[b][2]) <= 1.5:
                union(a, b)

    groups = {}
    for k in range(m):
        g = groups.setdefault(find(k), {"segs": set(), "polys": []})
        g["segs"].update(inter[k][:2])
        g["polys"].append(inter[k][2])
    return list(groups.values())


def mouths(seg, others, center):
    """沿 seg 的中心线找出它「离开其它臂路面」的位置，返回 [(t, outward_sign)]。"""
    line = seg["line"]
    L = line.length
    if L < 1e-6:
        return []
    n = max(4, int(math.ceil(L / STEP)))
    ts = [L * i / n for i in range(n + 1)]
    pts = [line.interpolate(t) for t in ts]
    inside = [others.contains(p) for p in pts]

    runs = []
    i = 0
    while i <= n:
        if inside[i]:
            j = i
            while j + 1 <= n and inside[j + 1]:
                j += 1
            runs.append((i, j))
            i = j + 1
        else:
            i += 1
    if not runs:
        return []

    ct = line.project(center)

    def dist_to_run(r):
        a, b = ts[r[0]], ts[r[1]]
        if a - 0.01 <= ct <= b + 0.01:
            return 0.0
        return min(abs(a - ct), abs(b - ct))

    i0, i1 = min(runs, key=dist_to_run)
    out = [(ts[max(0, i0 - 1)], -1), (ts[min(n, i1 + 1)], +1)]
    return out


def arm_geometry(seg, t, sign):
    """返回 (中心点, 外指方向, 两个边缘点, 角度, 该侧还剩多长)。"""
    line = seg["line"]
    L = line.length
    t0 = max(0.0, min(L, t))
    p = line.interpolate(t0)
    a = line.interpolate(max(0.0, t0 - 1.0))
    b = line.interpolate(min(L, t0 + 1.0))
    dx, dz = b.x - a.x, b.y - a.y
    dl = math.hypot(dx, dz) or 1.0
    ux, uz = dx / dl, dz / dl
    nx, nz = -uz, ux
    hw = seg["hw"]
    e1 = (p.x + nx * hw, p.y + nz * hw)
    e2 = (p.x - nx * hw, p.y - nz * hw)
    ox, oz = ux * sign, uz * sign
    ang = math.atan2(oz, ox)
    rest = t0 if sign < 0 else (L - t0)
    return (p.x, p.y), (ox, oz), [e1, e2], ang, rest


def merge_arms(arms, da_tol=0.30, d_tol=9.0):
    """把朝向相同、位置相邻的两条臂并成一条。

    双幅路（同一条主干道被 OSM 画成两条平行 way）在路口会产生两条角度几乎
    相同的臂，各自画一条斑马线就会在街角叠成一团。合并后位置取两臂中点、
    宽度取「间距 + 路宽」，一条斑马线正好横跨两幅车道。
    """
    out = []
    for a in arms:
        hit = None
        for b in out:
            d = math.hypot(a["x"] - b["x"], a["z"] - b["z"])
            dd = abs((a["a"] - b["a"] + math.pi) % (2 * math.pi) - math.pi)
            if dd < da_tol and d < d_tol:
                hit = b
                break
        if hit is None:
            out.append(dict(a))
            continue
        d = math.hypot(a["x"] - hit["x"], a["z"] - hit["z"])
        span = min(d + max(hit["w"], a["w"]), 16.0)
        hit["x"] = round((hit["x"] + a["x"]) / 2.0, 1)
        hit["z"] = round((hit["z"] + a["z"]) / 2.0, 1)
        hit["w"] = round(max(span, hit["w"], a["w"]), 1)
        hit["main"] = 1 if (hit["main"] or a["main"]) else 0
        hit["open"] = max(hit["open"], a["open"])
    return out


def build_junction(group, segs):
    members = group["segs"]
    polys = [segs[i]["poly"] for i in members]
    cores = group["polys"]
    if not cores:
        return None
    core = unary_union(cores)
    center = core.centroid

    edges = []
    arms = []
    for i in members:
        seg = segs[i]
        others = unary_union([segs[j]["poly"] for j in members if j != i])
        for (t, sign) in mouths(seg, others, center):
            c, o, es, ang, rest = arm_geometry(seg, t, sign)
            edges += es
            arms.append({
                "x": round(c[0], 1), "z": round(c[1], 1),
                "a": round(ang, 3), "w": round(seg["w"], 1),
                "main": seg["main"], "open": 1 if rest > 6.0 else 0,
            })
    if len(edges) < 3:
        return None

    hull = MultiPoint(edges).convex_hull
    if hull.is_empty or hull.area < MIN_AREA:
        return None
    # 关键：凸包只覆盖「各臂的嘴」之间的区域，斜向交叉时重叠菱形的四个角会
    # 露在凸包外面继续 z-fighting。把两两相交面（core）一起并进来，路口才盖满。
    hull = unary_union([hull, core])
    # 裁剪：别把沥青涂到草地上
    clip = unary_union(polys).buffer(CLIP_OUT, join_style=1)
    hull = hull.intersection(clip)
    if hull.is_empty:
        return None
    hull = hull.buffer(ROUND, join_style=1, quad_segs=3)
    hull = hull.buffer(-ROUND * 0.55, join_style=1, quad_segs=3)
    hull = hull.simplify(SIMPLIFY, preserve_topology=True)
    if hull.is_empty or hull.area < MIN_AREA:
        return None

    geoms = [hull] if hull.geom_type == "Polygon" else list(getattr(hull, "geoms", []))
    polys_out = [g for g in geoms if g.geom_type == "Polygon" and g.area >= MIN_AREA]
    if not polys_out:
        return None
    polys_out.sort(key=lambda g: -g.area)
    rings = [[[round(x, 1), round(y, 1)] for x, y in g.exterior.coords] for g in polys_out]

    big = polys_out[0]
    cx, cz = big.centroid.x, big.centroid.y

    uniq = merge_arms(arms)
    uniq.sort(key=lambda a: a["a"])
    # 每条臂记一个「出路口距离」out：从嘴点沿外指方向走到完全离开路口面的距离。
    # 前端画斑马线/停止线必须站在 out 之外，否则斜交/多岔路口的斑马线会压在路口面
    # 上互相叠成一团 —— 用户看到的「指示线重叠」就是它。
    guard = big.buffer(0.25)
    for a in uniq:
        ux, uz = math.cos(a["a"]), math.sin(a["a"])
        t = 0.0
        while t <= 14.0:
            if not guard.contains(Point(a["x"] + ux * t, a["z"] + uz * t)):
                break
            t += 0.5
        a["out"] = round(min(t, 14.0), 1)
    return {
        "cx": round(cx, 1), "cz": round(cz, 1),
        "kind": "vehicle",
        "arms": uniq,
        "rings": rings,
    }


# ------------------------------------------------------------------ 主流程
def main():
    argv = sys.argv[1:]
    campus = "north" if "north" in argv else "south"
    path = NORTH if campus == "north" else SOUTH
    write = "--write" in argv

    D, head, tail = load_data(path)
    segs = collect_segments(D)
    print("%s: 车行道段 %d" % (campus, len(segs)))

    groups = find_clusters(segs)
    print("%s: 路口簇 %d" % (campus, len(groups)))

    junctions = []
    for g in groups:
        j = build_junction(g, segs)
        if j:
            junctions.append(j)

    # 合并高度重叠的路口（复杂立交会被拆成几簇）
    merged = []
    for j in junctions:
        poly = Polygon(j["rings"][0])
        hit = None
        for m in merged:
            mp = Polygon(m["rings"][0])
            if poly.intersection(mp).area > 0.55 * min(poly.area, mp.area):
                hit = m
                break
        if hit:
            u = unary_union([Polygon(hit["rings"][0]), poly]).simplify(SIMPLIFY)
            if u.geom_type == "Polygon":
                hit["rings"] = [[[round(x, 1), round(y, 1)] for x, y in u.exterior.coords]]
            hit["arms"] = hit["arms"] + j["arms"]
        else:
            merged.append(j)

    total_area = sum(Polygon(j["rings"][0]).area for j in merged)
    print("路口 %d 个，总面积 %.0f m2" % (len(merged), total_area))
    for j in merged[:14]:
        print("  (%.1f, %.1f) 臂 %d 面积 %.0f m2" %
              (j["cx"], j["cz"], len(j["arms"]), Polygon(j["rings"][0]).area))

    if write:
        D["junctions"] = merged
        save_data(path, D, head, tail)

    try:
        draw(merged, D, campus)
    except Exception as e:  # 出图失败不影响数据
        print("出图跳过：%s" % e)


def draw(junctions, D, campus):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as MPoly

    fig, ax = plt.subplots(figsize=(12, 12), dpi=110)
    for r in D.get("roads") or []:
        if r.get("tunnel"):
            continue
        for pts in r.get("lines") or []:
            ax.plot([p[0] for p in pts], [p[1] for p in pts], color="#9aa0a6", lw=1.2, zorder=1)
    for j in junctions:
        for ring in j["rings"]:
            ax.add_patch(MPoly(ring, closed=True, facecolor="#d9534f",
                               edgecolor="#7a1f1c", lw=0.8, alpha=0.85, zorder=3))
    ax.set_aspect("equal")
    ax.set_title("junctions: %d (red) over road centrelines (%s)" % (len(junctions), campus))
    out = os.path.join(ROOT, "artifacts", "roads", "junctions_%s.png" % campus)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fig.savefig(out, bbox_inches="tight")
    plt.close(fig)
    print("出图 %s" % out)


if __name__ == "__main__":
    main()
