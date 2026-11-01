# -*- coding: utf-8 -*-
"""WGS84 -> UTM49N -> 本地米制坐标（与 gdufs-data.js 一致）。

gdufs-data.js 的约定（见 gdufs-south-campus/scripts/build_nav_data.py）：
    x = -(E - E0)     # 镜像后西为正
    z =  (N - N0)     # 北为正
不依赖 pyproj，用 Snyder 公式手算（误差 < 1 cm，够用）。
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "gdufs-3d", "gdufs-data.js")

# WGS84
_A = 6378137.0
_F = 1 / 298.257223563
_E2 = _F * (2 - _F)
_K0 = 0.9996


def lonlat_to_utm(lon, lat, zone=49):
    """返回 (easting, northing)，北半球。"""
    lat = math.radians(lat)
    lon = math.radians(lon)
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)

    e2 = _E2
    ep2 = e2 / (1 - e2)
    N = _A / math.sqrt(1 - e2 * math.sin(lat) ** 2)
    T = math.tan(lat) ** 2
    C = ep2 * math.cos(lat) ** 2
    A = math.cos(lat) * (lon - lon0)

    M = _A * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat
              - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * lat)
              + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * lat)
              - (35 * e2 ** 3 / 3072) * math.sin(6 * lat))

    easting = _K0 * N * (A + (1 - T + C) * A ** 3 / 6
                         + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000.0
    northing = _K0 * (M + N * math.tan(lat) * (A ** 2 / 2
                     + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
                     + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720))
    return easting, northing


def load_data(path=DATA):
    text = open(path, encoding="utf-8").read()
    i = text.index("{")
    obj, _ = json.JSONDecoder().raw_decode(text[i:])
    return obj


def origin(data=None):
    d = data or load_data()
    m = d["meta"]["origin_utm"]
    return m["easting"], m["northing"]


def to_local(lon, lat, e0=None, n0=None, data=None):
    if e0 is None:
        e0, n0 = origin(data)
    e, n = lonlat_to_utm(lon, lat)
    return -(e - e0), (n - n0)


def way_to_local(geom, e0=None, n0=None, data=None):
    if e0 is None:
        e0, n0 = origin(data)
    out = []
    for pt in geom:
        if isinstance(pt, dict):
            lon, lat = pt["lon"], pt["lat"]
        else:
            lon, lat = pt[0], pt[1]
        out.append(to_local(lon, lat, e0, n0))
    return out


def load_osm_roads(path=None):
    """返回 [(tags, [[x,z],...]), ...]，已投影到本地坐标。"""
    p = path or os.path.join(ROOT, "gdufs-south-campus", "02_osm", "roads.json")
    d = json.load(open(p, encoding="utf-8"))
    e0, n0 = origin()
    out = []
    for el in d["elements"]:
        if el.get("type") != "way":
            continue
        g = el.get("geometry") or []
        if len(g) < 2:
            continue
        tags = dict(el.get("tags") or {})
        tags["_id"] = el.get("id")
        out.append((tags, way_to_local(g, e0, n0)))
    return out


if __name__ == "__main__":
    # 自检：把 OSM 边界投影后和 gdufs-data.js 里的 boundary 对比
    from shapely.geometry import Polygon
    d = load_data()
    rings = d["boundary"]
    print("boundary rings:", [len(r) for r in rings])
    print("ring0 bbox:", Polygon(rings[0]).bounds)
    roads = load_osm_roads()
    print("osm ways:", len(roads))
    xs = [p[0] for _, l in roads for p in l]
    zs = [p[1] for _, l in roads for p in l]
    print("roads bbox x %.0f..%.0f  z %.0f..%.0f" % (min(xs), max(xs), min(zs), max(zs)))
