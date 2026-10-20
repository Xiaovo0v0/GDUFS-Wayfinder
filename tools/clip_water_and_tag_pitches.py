# -*- coding: utf-8 -*-
"""1) 把湖面/水系裁剪到校园边界内；2) 给运动场地按 OSM 的 sport 标签分类。"""
import json
import math

from shapely.geometry import LineString, Polygon, MultiLineString, MultiPolygon
from shapely.ops import unary_union

ROOT = r"C:\Users\86134\Desktop\gdufs"
FILE = ROOT + r"\gdufs-3d\gdufs-data.js"

raw = open(FILE, encoding="utf-8").read()
body = raw[raw.index("=") + 1:].strip().rstrip(";")
D = json.loads(body)

# ---------- 校园边界 ----------
boundary = unary_union([Polygon(r) for r in D["boundary"] if len(r) >= 3])
print("boundary area", round(boundary.area), "m2")

# ---------- 1) 裁剪水面 ----------
clipped_lakes = []
for w in D.get("waterPolygons", []):
    for ring in w["rings"]:
        g = Polygon(ring)
        if not g.is_valid:
            g = g.buffer(0)
        c = g.intersection(boundary)
        geoms = getattr(c, "geoms", [c])
        for poly in geoms:
            if poly.is_empty or poly.area < 30:
                continue
            coords = [[round(x, 1), round(y, 1)] for x, y in poly.exterior.coords]
            clipped_lakes.append({"name": w["name"], "source": w["source"], "rings": [coords]})
D["waterPolygons"] = clipped_lakes
print("lakes clipped:", len(clipped_lakes), "area", round(sum(Polygon(w['rings'][0]).area for w in clipped_lakes)))

# ---------- 裁剪河道 ----------
if D.get("water"):
    lanes = []
    for w in D["water"]:
        for line in w["lines"]:
            ls = LineString(line)
            c = ls.intersection(boundary)
            geoms = getattr(c, "geoms", [c])
            for seg in geoms:
                if seg.is_empty or seg.length < 15:
                    continue
                coords = [[round(x, 1), round(y, 1)] for x, y in seg.coords]
                if len(coords) >= 2:
                    lanes.append({"name": w["name"], "kind": w["kind"], "lines": [coords]})
    D["water"] = lanes
    print("water lanes clipped:", len(lanes))

# ---------- 2) 运动场地分类 ----------
LON0 = D["meta"]["origin_wgs84"]["lon"]
LAT0 = D["meta"]["origin_wgs84"]["lat"]
KX = 111320 * math.cos(math.radians(LAT0))
KZ = 110540


def to_local(lon, lat):
    return (-(lon - LON0) * KX, (lat - LAT0) * KZ)


osm = json.load(open(ROOT + r"\gdufs-south-campus\02_osm\landscape.json", encoding="utf-8"))
els = osm.get("elements", osm)

sports = []  # (cx, cz, area, sport)
for e in els:
    t = e.get("tags") or {}
    if t.get("leisure") != "pitch":
        continue
    sport = t.get("sport")
    if not sport:
        continue
    if e.get("type") == "way" and e.get("geometry"):
        pts = [to_local(p["lon"], p["lat"]) for p in e["geometry"]]
    elif e.get("type") == "relation" and e.get("members"):
        pts = []
        for m in e["members"]:
            for p in (m.get("geometry") or []):
                pts.append(to_local(p["lon"], p["lat"]))
    else:
        continue
    if len(pts) < 3:
        continue
    try:
        g = Polygon(pts)
        if not g.is_valid:
            g = g.buffer(0)
    except Exception:
        continue
    sports.append((g.centroid.x, g.centroid.y, g.area, sport))

print("osm pitches with sport:", len(sports))

used = set()
matched = 0
for item in D["landscape"]:
    if item.get("kind") != "pitch":
        continue
    ring = item["rings"][0]
    g = Polygon(ring)
    if not g.is_valid:
        g = g.buffer(0)
    c = g.centroid
    best = None
    for i, (sx, sz, sa, sp) in enumerate(sports):
        if i in used:
            continue
        d = math.hypot(sx - c.x, sz - c.y)
        if d > 26:
            continue
        ratio = sa / max(g.area, 1)
        if ratio < 0.45 or ratio > 2.2:
            continue
        if best is None or d < best[0]:
            best = (d, i, sp)
    if best:
        used.add(best[1])
        item["sport"] = best[2]
        matched += 1

print("pitches matched:", matched, "/", sum(1 for x in D["landscape"] if x.get("kind") == "pitch"))
from collections import Counter
print(Counter(x.get("sport") for x in D["landscape"] if x.get("kind") == "pitch"))

open(FILE, "w", encoding="utf-8", newline="\n").write("window.GDUFS_DATA = " + json.dumps(D, ensure_ascii=False) + ";\n")
print("written", FILE)
