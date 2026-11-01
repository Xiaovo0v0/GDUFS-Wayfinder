# -*- coding: utf-8 -*-
"""重建南校路网：直接从 OSM 原始道路挑，沿校区边界保留整条，不再按建筑缓冲区剪碎。

为什么重写
----------
之前的管线（roads_clip → roads_weld → roads_trim → roads_ring）是「按建筑外扩
60 m 剪」的思路：只有楼群附近的路才留。问题是外环路离楼群 50–80 m，正好被剪
掉，于是校区边界上出现大段没有路的缺口，看起来就是「路一节一节」。

新做法
------
保留区 = 校区边界外扩 KEEP 米（默认 45）∪ 各校门 45 m。外环路一般离边界
15–35 m，整条都能留下来；只有真正伸到校外的路段才在保留区边上被切断。

同时重建导航图（nodes/edges），把建筑、校门重新接驳到新路网上。

用法
----
    python tools/rebuild_roads.py              # 预演：出统计 + 对照图
    python tools/rebuild_roads.py --write      # 写回 gdufs-3d/gdufs-data.js
    python tools/rebuild_roads.py --keep 55    # 换保留宽度
"""
import argparse
import collections
import json
import math
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MPoly
from shapely.geometry import LineString, MultiLineString, Point, Polygon
from shapely.ops import linemerge, unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo_proj as G  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "gdufs-3d", "gdufs-data.js")
OUT = os.path.join(ROOT, "artifacts", "roads")
os.makedirs(OUT, exist_ok=True)

VEHICLE = {"primary", "primary_link", "secondary", "secondary_link", "tertiary",
           "tertiary_link", "residential", "unclassified", "living_street",
           "service", "track", "trunk", "trunk_link", "motorway", "motorway_link"}
PED = {"footway", "path", "steps", "pedestrian", "cycleway", "corridor", "elevator"}
KEEP_HW = VEHICLE | PED

MIN_PIECE = 6.0      # 切断后短于这个长度的碎段丢掉（除非它是唯一连接）
SIMPLIFY = 0.45      # 折线简化容差（m）
SNAP = 2.5           # 端点吸附（m）：OSM 共享节点本来就重合，这里只兜底

COLOR = {
    "primary": "#b71c1c", "primary_link": "#e57373",
    "secondary": "#e65100", "secondary_link": "#ffb74d",
    "tertiary": "#f9a825", "tertiary_link": "#fff176",
    "residential": "#6d4c41", "unclassified": "#8d6e63", "service": "#5c6bc0",
    "track": "#26a69a", "motorway": "#7b1fa2",
    "footway": "#2e7d32", "path": "#66bb6a", "steps": "#a5d6a7",
    "pedestrian": "#43a047", "cycleway": "#00acc1",
}


def load_data(path=DATA):
    text = open(path, encoding="utf-8").read()
    i = text.index("{")
    obj, _ = json.JSONDecoder().raw_decode(text[i:])
    return obj, text[:i], text[i + len(json.dumps(obj, ensure_ascii=False)):]


def poly_len(pts):
    return sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
               for i in range(len(pts) - 1))


def parts_of(geom):
    if geom.is_empty:
        return []
    if geom.geom_type == "LineString":
        return [geom]
    if geom.geom_type in ("MultiLineString", "GeometryCollection"):
        out = []
        for g in geom.geoms:
            out += parts_of(g)
        return out
    return []


# ---------------------------------------------------------------- 路网挑选
def build_roads(D, raw, keep_m):
    zones = []
    for r in D["boundary"]:
        p = Polygon(r)
        if not p.is_valid:
            p = p.buffer(0)
        zones.append(p)
    mask = unary_union([z.buffer(keep_m) for z in zones])
    gate_mask = unary_union([Point(g["x"], g["z"]).buffer(45) for g in D["gates"] if "x" in g])
    mask = unary_union([mask, gate_mask])

    out = []
    dropped = collections.Counter()
    for tags, coords in raw:
        hw = tags.get("highway")
        if hw not in KEEP_HW:
            continue
        if len(coords) < 2:
            continue
        ls = LineString(coords)
        if ls.length < 2:
            continue
        ls = ls.simplify(SIMPLIFY, preserve_topology=False)
        if not ls.intersects(mask):
            dropped[hw] += 1
            continue
        inter = ls.intersection(mask)
        for piece in parts_of(inter):
            if piece.length < MIN_PIECE:
                dropped[hw] += 1
                continue
            pts = [[round(x, 1), round(z, 1)] for (x, z) in piece.coords]
            # 去掉连续重复点
            clean = [pts[0]]
            for p in pts[1:]:
                if p != clean[-1]:
                    clean.append(p)
            if len(clean) < 2 or poly_len(clean) < MIN_PIECE:
                dropped[hw] += 1
                continue
            out.append({
                "name": tags.get("name") or tags.get("name:zh") or "",
                "highway": hw,
                "tunnel": bool(tags.get("tunnel") in ("yes", "true", "1")),
                "bridge": bool(tags.get("bridge") in ("yes", "true", "1")),
                "_id": tags.get("_id"),
                "lines": [clean],
            })
    return out, mask, dropped


def merge_same_way(roads):
    """同一条 OSM way 被保留区切成几段时，合成一个条目（多条 lines）。"""
    buckets = collections.OrderedDict()
    for r in roads:
        key = (r.get("_id"), r["name"], r["highway"], r["tunnel"], r["bridge"])
        buckets.setdefault(key, []).append(r)
    out = []
    for (wid, name, hw, tun, br), items in buckets.items():
        lines = [ln for it in items for ln in it["lines"]]
        out.append({"name": name, "highway": hw, "tunnel": tun, "bridge": br, "lines": lines})
    return out


def dedupe(roads):
    """去掉几何几乎重合的重复描线（OSM 里同一条路被画两遍的情况）。"""
    from shapely.strtree import STRtree
    flat = []
    for ri, r in enumerate(roads):
        for li, ln in enumerate(r["lines"]):
            flat.append((ri, li, LineString(ln)))
    tree = STRtree([f[2] for f in flat])
    dead = set()
    for i, (ri, li, g) in enumerate(flat):
        if (ri, li) in dead:
            continue
        for j in tree.query(g.buffer(3.0)):
            j = int(j)
            if j <= i:
                continue
            rj, lj, h = flat[j]
            if (rj, lj) in dead:
                continue
            if abs(g.length - h.length) > max(6.0, 0.12 * g.length):
                continue
            if g.hausdorff_distance(h) <= 3.0:
                dead.add((rj, lj))
    if not dead:
        return roads, 0
    out = []
    for ri, r in enumerate(roads):
        lines = [ln for li, ln in enumerate(r["lines"]) if (ri, li) not in dead]
        if lines:
            r2 = dict(r)
            r2["lines"] = lines
            out.append(r2)
    return out, len(dead)


def weld(roads, snap=SNAP):
    """端点吸附：把 2.5 m 内的断头端点接到最近的路上去（做成丁字口）。"""
    from shapely.strtree import STRtree
    flat = []
    for ri, r in enumerate(roads):
        for li, ln in enumerate(r["lines"]):
            flat.append((ri, li, LineString(ln)))
    if not flat:
        return 0
    tree = STRtree([f[2] for f in flat])
    moved = 0
    for i, (ri, li, g) in enumerate(flat):
        line = roads[ri]["lines"][li]
        for which in (0, -1):
            p = Point(line[which])
            best = None
            for j in tree.query(p.buffer(snap)):
                j = int(j)
                if j == i:
                    continue
                h = flat[j][2]
                q = h.interpolate(h.project(p))
                d = p.distance(q)
                if d <= snap and (best is None or d < best[0]):
                    best = (d, q)
            if best:
                line[which] = [round(best[1].x, 1), round(best[1].y, 1)]
                moved += 1
    return moved


def _unit(v):
    l = math.hypot(v[0], v[1])
    return (v[0] / l, v[1] / l) if l > 1e-9 else (0.0, 0.0)


def stitch(roads, max_gap=18.0, cos_tol=0.86):
    """把「两端对着彼此」的断口接起来（只接同等级的道路）。

    裁剪 + 焊接之后，同一条路常被切成两段，中间留 2~18 m 的缺口，
    俯视就是路中间露一块草——用户说的「断成一节一节」里最难看的那些。
    只有两个端点的切线都指向对方时才接，避免把平行的两条路硬粘成一条。
    """
    ends = []
    for ri, r in enumerate(roads):
        for li, pts in enumerate(r["lines"]):
            if len(pts) < 2:
                continue
            ends.append({"ri": ri, "li": li, "w": 0, "pt": pts[0],
                         "tan": _unit((pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]))})
            ends.append({"ri": ri, "li": li, "w": 1, "pt": pts[-1],
                         "tan": _unit((pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1]))})
    joins = []
    for i in range(len(ends)):
        a = ends[i]
        for j in range(i + 1, len(ends)):
            b = ends[j]
            ka, kb = (a["ri"], a["li"]), (b["ri"], b["li"])
            if ka == kb:
                continue
            if roads[a["ri"]].get("highway") != roads[b["ri"]].get("highway"):
                continue
            dx, dz = b["pt"][0] - a["pt"][0], b["pt"][1] - a["pt"][1]
            d = math.hypot(dx, dz)
            if d < 1e-6 or d > max_gap:
                continue
            u = (dx / d, dz / d)
            if a["tan"][0] * u[0] + a["tan"][1] * u[1] < cos_tol:
                continue
            if b["tan"][0] * -u[0] + b["tan"][1] * -u[1] < cos_tol:
                continue
            joins.append((d, ka, a["w"], kb, b["w"]))
    if not joins:
        return 0
    joins.sort()

    lines = {}
    for ri, r in enumerate(roads):
        for li, pts in enumerate(r["lines"]):
            lines[(ri, li)] = list(pts)
    alive = set(lines)
    taken = set()
    merged = 0
    for d, ka, wa, kb, wb in joins:
        if ka not in alive or kb not in alive:
            continue
        if (ka, wa) in taken or (kb, wb) in taken:
            continue
        A = lines[ka]
        B = lines[kb]
        if wa == 0:
            A = A[::-1]
        if wb == 1:
            B = B[::-1]
        lines[ka] = A + B[1:]
        alive.discard(kb)
        taken.add((ka, wa))
        taken.add((ka, 1 - wa))
        taken.add((kb, wb))
        taken.add((kb, 1 - wb))
        merged += 1
    if not merged:
        return 0
    out = []
    for ri, r in enumerate(roads):
        keep = []
        for li, pts in enumerate(r["lines"]):
            if (ri, li) in alive:
                keep.append([[round(p[0], 1), round(p[1], 1)] for p in lines[(ri, li)]])
        if keep:
            r = dict(r)
            r["lines"] = keep
            out.append(r)
    roads[:] = out
    return merged


def bridge_orphans(roads, D=None, max_gap=28.0, max_len=90.0,
                   keep_len=45.0, bld_near=14.0):
    """处理孤立路片：能接到楼上的补一段接驳，接不上又很短的直接删。

    裁剪和焊接之后会留下一些两头都接不上的碎段（尤其步道），
    躺在草地上就是一条白色小短线，远看正是用户说的「断成一节一节」。
    如果碎段的自由端离某栋楼很近，说明它是「通往这栋楼的小路」，
    补一条接驳线接回主路网；否则就是纯碎头，删掉。
    """
    from shapely.strtree import STRtree
    flat = []
    for ri, r in enumerate(roads):
        for li, ln in enumerate(r["lines"]):
            if len(ln) >= 2:
                flat.append((ri, li, LineString(ln)))
    if not flat:
        return 0, 0

    blds = []
    for b in (D or {}).get("buildings") or []:
        for ring in b.get("rings") or []:
            if len(ring) >= 4:
                p = Polygon(ring)
                if not p.is_valid:
                    p = p.buffer(0)
                if not p.is_empty:
                    blds.append(p)

    def near_building(p, tol):
        return any(b.distance(p) <= tol for b in blds)

    def others_join(i, p, tol):
        for j, (_, _, h) in enumerate(flat):
            if j == i:
                continue
            if h.distance(p) <= tol:
                return True
        return False

    added, dropped = 0, 0
    tree = STRtree([f[2] for f in flat])
    drop = []
    for i, (ri, li, g) in enumerate(flat):
        a = Point(g.coords[0])
        b = Point(g.coords[-1])
        if others_join(i, a, 6.0) or others_join(i, b, 6.0):
            continue
        if g.length > max_len:
            continue
        # 找最近的另一条路
        best = None
        for j in tree.query(g.buffer(max_gap)):
            j = int(j)
            if j == i:
                continue
            h = flat[j][2]
            for end in (a, b):
                q = h.interpolate(h.project(end))
                d = end.distance(q)
                if d <= max_gap and (best is None or d < best[0]):
                    best = (d, end, q, j)
        if best is None:
            drop.append((ri, li))
            continue
        d, end, q, j = best
        far = b if end is a else a
        if g.length < keep_len and not near_building(far, bld_near):
            drop.append((ri, li))          # 纯碎头，接了也是根断指
            continue
        roads[ri]["lines"].append([[round(end.x, 1), round(end.y, 1)],
                                   [round(q.x, 1), round(q.y, 1)]])
        added += 1
    for ri, li in sorted(drop, reverse=True):
        try:
            roads[ri]["lines"].pop(li)
        except IndexError:
            pass
    roads[:] = [r for r in roads if r["lines"]]
    return added, len(drop)


# ---------------------------------------------------------------- 导航图
class GraphBuilder:
    def __init__(self):
        self.nodes = []
        self.edges = []

    def add_node(self, p):
        x, z = round(p[0], 1), round(p[1], 1)
        for i, (nx, nz) in enumerate(self.nodes):
            if abs(nx - x) <= 0.6 and abs(nz - z) <= 0.6:
                return i
        self.nodes.append([x, z])
        return len(self.nodes) - 1

    def find_endpoint(self, p):
        for i, (nx, nz) in enumerate(self.nodes):
            if abs(nx - p[0]) <= SNAP and abs(nz - p[1]) <= SNAP:
                return i
        return self.add_node(p)

    def nearest_edge(self, p):
        best = None
        for ei, e in enumerate(self.edges):
            d, si, t, q = project(self.edges[ei]["pts"], p)
            if best is None or d < best[0]:
                best = (d, ei, si, t, q)
        return best

    def split_edge(self, ei, si, t, q):
        e = self.edges[ei]
        pts = e["pts"]
        q = [round(q[0], 1), round(q[1], 1)]
        a, b = e["a"], e["b"]
        if t <= 1e-6 and si == 0:
            return a
        if t >= 1 - 1e-6 and si == len(pts) - 2:
            return b
        qn = self.add_node(q)
        if qn == a:
            return a
        if qn == b:
            return b
        if t <= 1e-6:
            left, right = pts[:si + 1], pts[si:]
        elif t >= 1 - 1e-6:
            left, right = pts[:si + 2], pts[si + 1:]
        else:
            left, right = pts[:si + 1] + [q], [q] + pts[si + 1:]
        new_edges = []
        if len(left) >= 2:
            new_edges.append({"a": a, "b": qn, "len": round(poly_len(left), 1), "pts": left})
        if len(right) >= 2:
            new_edges.append({"a": qn, "b": b, "len": round(poly_len(right), 1), "pts": right})
        if not new_edges:
            return a
        self.edges[ei] = new_edges[0]
        self.edges.extend(new_edges[1:])
        return qn

    def connect_point(self, p):
        d, ei, si, t, q = self.nearest_edge(p)
        qn = self.split_edge(ei, si, t, q)
        dn = self.add_node(p)
        dd = math.hypot(p[0] - q[0], p[1] - q[1])
        if qn != dn and dd > 0.8:
            self.edges.append({
                "a": qn, "b": dn, "len": round(dd, 1),
                "pts": [[round(q[0], 1), round(q[1], 1)], [round(p[0], 1), round(p[1], 1)]],
                "connector": True,
            })
        return dn, d


def project(pts, p):
    """点到折线最近点；返回 (距离, 段号, 段内比例, 最近点)。"""
    best = None
    for i in range(len(pts) - 1):
        ax, az = pts[i]
        bx, bz = pts[i + 1]
        dx, dz = bx - ax, bz - az
        L2 = dx * dx + dz * dz
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - az) * dz) / L2))
        qx, qz = ax + dx * t, az + dz * t
        d = math.hypot(p[0] - qx, p[1] - qz)
        if best is None or d < best[0]:
            best = (d, i, t, (qx, qz))
    return best


CITY_ROAD = {"primary", "primary_link", "secondary", "secondary_link",
             "tertiary", "tertiary_link", "trunk", "trunk_link",
             "motorway", "motorway_link"}
DOOR_MAX = 40.0      # 门口到校内路网的接驳上限（m）


def nearest_edge(gb, p, roads_only=False):
    """点到导航图最近边：返回 (距离, 最近点)。

    roads_only=True 时跳过 connector（建筑/校门的接驳边）。挑门点时必须这样：
    接驳边是「上一次挑出来的门」留下的，拿它参与打分会让门点自我强化、每次重建
    在 OSM 门点和校区顶点之间来回翻（实测 17 栋每次都翻）。
    """
    best = None
    for e in gb.edges:
        if roads_only and e.get("connector"):
            continue
        d, si, t, q = project(e["pts"], p)
        if best is None or d < best[0]:
            best = (d, q)
    return best


def choose_door(b, campus, gb, walls):
    """给一栋楼挑「导航接驳门口」。

    为什么不能直接用 OSM 的 entrance：不少楼的门点落在临街（围墙外环路）那一面，
    它离校外马路 4–9 m，`connect_point` 会高高兴兴接到城市道路上，于是路线一出
    门就顺着校外马路走。这里把候选点扩到「门点 + 外墙所有顶点」，按
    「接驳长度 + 出界长度×3 + 穿楼×60 + 钻进自己楼里」打分，挑最像校内可达的那个。
    """
    bid = id(b)
    own = None
    if b.get("rings"):
        own = Polygon(b["rings"][0]).buffer(0)
    cands = []
    osm_door = b.get("entrance_osm") or b.get("access")
    cur = b.get("access")
    if osm_door:
        cands.append((osm_door[0], osm_door[1], True))
    if cur and (not osm_door or abs(cur[0] - osm_door[0]) > 0.2 or abs(cur[1] - osm_door[1]) > 0.2):
        cands.append((cur[0], cur[1], False))
    for ring in b.get("rings") or []:
        for p in ring:
            cands.append((p[0], p[1], False))
    if not cands:
        return None
    best = None
    for x, z, is_osm in cands:
        pt = Point(x, z)
        if campus.distance(pt) > 3.0:
            continue
        d, q = nearest_edge(gb, (x, z), roads_only=True)
        if d > DOOR_MAX:
            continue
        seg = LineString([(x, z), q])
        out = seg.difference(campus).length
        if out > 2.0:
            continue
        cross = 0
        for wid, w in walls:
            if wid == bid:
                continue
            if seg.intersection(w).length > 0.5:
                cross += 1
        self_len = own.intersection(seg).length if own is not None else 0.0
        score = d + 3.0 * out + 60.0 * cross + 4.0 * max(0.0, self_len - 0.6)
        if is_osm:
            score -= 20.0                     # 平手时宁可保留 OSM 门点（差 20 m 以内不换）
        if best is None or score < best[0]:
            best = (score, (x, z), d, out, cross)
    return best


def build_graph(D, roads, join_max=30.0, door_max=None, city_roads=CITY_ROAD):
    """导航图 = 校区边界**以内**的步行路网。

    两条硬规则（2026-11 修订，之前用 boundary.buffer(6) 导致路线出校）：
    1. 城市道路（primary/secondary/tertiary 及其 link）整条剔除——它们是校外的
       环路/中环东路/贝岗村大街，校园向导不该走；
    2. 其余道路只保留落在校区多边形内的部分（不再外扩 6 m，否则贴着围墙的
       外环路人行道会整段溜进图里，正是「北苑1栋→学生活动中心」绕校外的原因）。
    例外：地下隧道整条保留，它是生活区与教学区之间唯一的步行通道。

    北校要传 `city_roads=set()`：那边的 `highway` 是按路宽猜的（14.6 m 的 secondary
    其实是校内主路），照南校的口径整条剔了会把主路网剔空。
    """
    global DOOR_MAX
    if door_max:
        DOOR_MAX = door_max
    gb = GraphBuilder()
    zones = [Polygon(r).buffer(0) for r in D["boundary"]]
    campus = unary_union(zones)
    lines = []
    for r in roads:
        if not r.get("tunnel") and r.get("highway") in city_roads:
            continue
        for ln in r["lines"]:
            if len(ln) < 2:
                continue
            ls = LineString(ln)
            if r.get("tunnel"):
                lines.append(ls)
                continue
            if not ls.intersects(campus):
                continue
            cut = ls.intersection(campus)
            lines += [g for g in parts_of(cut) if g.length >= 2.0]
    merged = linemerge(unary_union(lines))
    segs = [merged] if merged.geom_type == "LineString" else list(merged.geoms)
    segs = [s for s in segs if s.length >= 2.0]
    for seg in segs:
        coords = list(seg.coords)
        a = gb.find_endpoint(coords[0])
        b = gb.find_endpoint(coords[-1])
        if a == b:
            continue
        pts = [[round(x, 1), round(z, 1)] for (x, z) in coords]
        gb.edges.append({"a": a, "b": b, "len": round(poly_len(pts), 1), "pts": pts})

    # 建筑接驳：门口必须落在校区内侧，接驳线不许出界、不许穿别的楼
    walls = [(id(b), Polygon(b["rings"][0]).buffer(0))
             for b in D["buildings"] if b.get("rings")]
    for b in D["buildings"]:
        if not b.get("name"):
            continue
        pick = choose_door(b, campus, gb, walls)
        if pick is None:
            door = b.get("access")
            if not door:
                ring = b["rings"][0]
                door = [sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)]
        else:
            door = [round(pick[1][0], 1), round(pick[1][1], 1)]
            old = b.get("access")
            if old and (abs(old[0] - door[0]) > 0.2 or abs(old[1] - door[1]) > 0.2):
                # 只记第一次的真实 OSM 门点。若每次都覆盖，entrance_osm 会变成
                # 「上一轮挑出来的门」，下一轮就拿着它当 OSM 门点给 -20 分，
                # 于是每次重建都在两个门点之间来回翻。
                if not b.get("entrance_osm"):
                    b["entrance_osm"] = [round(old[0], 1), round(old[1], 1)]
            b["access"] = door
        node, d = gb.connect_point((door[0], door[1]))
        b["node"] = node
        b["access_dist"] = round(d, 1)

    for g in D["gates"]:
        if "x" not in g:
            continue
        node, d = gb.connect_point((g["x"], g["z"]))
        g["node"] = node
        g["access_dist"] = round(d, 1)

    # 主连通分量修复
    parent = list(range(len(gb.nodes)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[ry] = rx

    def recompute():
        parent[:] = list(range(len(gb.nodes)))
        for e in gb.edges:
            union(e["a"], e["b"])
        comp = collections.Counter(find(i) for i in range(len(parent)))
        return comp, comp.most_common(1)[0][0]

    # 连通分量缝合：只在两片路网离得很近（<= JOIN_MAX）时才补一条接驳边，
    # 绝不为了「凑成一个连通分量」拉几百米的直线（那会让导航路线穿过草坪）。
    JOIN_MAX = join_max
    repaired = 0
    comp, main = recompute()
    while len(comp) > 1:
        best = None
        groups = {}
        for i in range(len(gb.nodes)):
            groups.setdefault(find(i), []).append(i)
        roots = list(groups)
        for a in range(len(roots)):
            for b in range(a + 1, len(roots)):
                for i in groups[roots[a]]:
                    pi = gb.nodes[i]
                    for j in groups[roots[b]]:
                        pj = gb.nodes[j]
                        d = math.hypot(pi[0] - pj[0], pi[1] - pj[1])
                        if d <= JOIN_MAX and (best is None or d < best[0]):
                            best = (d, i, j)
        if best is None:
            break
        d, i, j = best
        gb.edges.append({
            "a": i, "b": j, "len": round(d, 1),
            "pts": [[round(gb.nodes[i][0], 1), round(gb.nodes[i][1], 1)],
                    [round(gb.nodes[j][0], 1), round(gb.nodes[j][1], 1)]],
            "connector": True,
        })
        repaired += 1
        comp, main = recompute()

    off_b = [b.get("name") for b in D["buildings"] if b.get("name") and b.get("node") is not None
             and find(b["node"]) != main]
    off_g = [g.get("name") for g in D["gates"] if "x" in g and find(g["node"]) != main]
    return gb, repaired, comp, off_b, off_g


# ---------------------------------------------------------------- 出图
def plot(D, old_roads, new_roads, mask, path):
    zones = [Polygon(r) for r in D["boundary"]]
    fig, axes = plt.subplots(1, 2, figsize=(18, 10), dpi=100)
    for ax, roads, title in ((axes[0], old_roads, "before (current data)"),
                             (axes[1], new_roads, "after (rebuilt from OSM)")):
        for z in zones:
            ax.add_patch(MPoly(list(z.exterior.coords), closed=True, fill=True,
                               facecolor="#f2f5ec", edgecolor="#2e7d32", lw=1.2, ls="--", zorder=0))
        for r in roads:
            hw = r.get("highway") or "unknown"
            for ln in r.get("lines", []):
                ls = LineString(ln)
                x, y = ls.xy
                ax.plot(x, y, color=COLOR.get(hw, "#607d8b"), lw=1.3, zorder=3)
        for g in D["gates"]:
            if "x" in g:
                ax.plot(g["x"], g["z"], "o", color="#e65100", ms=4, zorder=5)
        ax.set_aspect("equal")
        ax.grid(alpha=0.15)
        ax.set_title(title)
    fig.tight_layout()
    fig.savefig(path)
    print("对照图 →", path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--keep", type=float, default=45.0)
    args = ap.parse_args()

    D, head, tail = load_data()
    raw = G.load_osm_roads()
    old_roads = D["roads"]

    roads, mask, dropped = build_roads(D, raw, args.keep)
    roads = merge_same_way(roads)
    roads, dup = dedupe(roads)
    moved = weld(roads)
    stitched = stitch(roads)
    bridged, killed = bridge_orphans(roads, D)
    roads = [r for r in roads if r["lines"]]

    total = sum(poly_len(ln) for r in roads for ln in r["lines"])
    old_total = sum(poly_len(ln) for r in old_roads for ln in r["lines"])
    print("道路条目 %d → %d" % (len(old_roads), len(roads)))
    print("线段 %d → %d" % (sum(len(r["lines"]) for r in old_roads),
                            sum(len(r["lines"]) for r in roads)))
    print("总长 %.0f m → %.0f m" % (old_total, total))
    print("去重 %d 段，端点吸附 %d 处，孤立段接驳 %d / 删除 %d" % (dup, moved, bridged, killed))
    print("丢弃（太短/在保留区外）：", dict(dropped.most_common(8)))

    gb, repaired, comp, off_b, off_g = build_graph(D, roads)
    print("导航图：节点 %d，边 %d，连通分量 %d（最大 %d），修复 %d"
          % (len(gb.nodes), len(gb.edges), len(comp), comp.most_common(1)[0][1], repaired))
    print("脱离主分量的建筑 %d 个：%s" % (len(off_b), off_b[:6]))
    print("脱离主分量的校门 %d 个：%s" % (len(off_g), off_g[:6]))

    # places 节点同步
    for pl in D.get("places") or []:
        ref = pl.get("ref")
        if pl.get("kind") == "building":
            for b in D["buildings"]:
                if b.get("id") == ref and b.get("node") is not None:
                    pl["node"] = b["node"]
                    break
        elif pl.get("kind") == "gate":
            for g in D["gates"]:
                if (g.get("name") or "") == ref and g.get("node") is not None:
                    pl["node"] = g["node"]
                    break

    plot(D, old_roads, roads, mask, os.path.join(OUT, "rebuild_compare.png"))

    if args.write:
        out = dict(D)
        out["roads"] = roads
        out["graph"] = {"nodes": gb.nodes, "edges": gb.edges}
        text = head + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + tail
        with open(DATA, "w", encoding="utf-8", newline="") as f:
            f.write(text)
        print("已写回 %s（%.1f KB）" % (DATA, len(text.encode("utf-8")) / 1024))
    else:
        print("（预演，未写入；加 --write 写回）")


if __name__ == "__main__":
    main()
