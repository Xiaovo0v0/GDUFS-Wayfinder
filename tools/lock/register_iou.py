# -*- coding: utf-8 -*-
"""用 IoU 做无名称配准：最大化 模型建筑并集 与 OSM 建筑并集 的重叠。

比"最近距离"目标更连续，Powell 下去不容易卡平台。
参数：dx, dy (m) + theta(deg) + s（等比）或 sx/sz（分轴）。

用法:
  python tools/lock/register_iou.py --aniso --out artifacts/lock/north_iou.json
"""
import argparse
import io
import json

import numpy as np
from scipy.optimize import minimize
from shapely import affinity
from shapely.geometry import Polygon
from shapely.ops import unary_union

KZ = 110540.0


def load_model(path):
    s = io.open(path, encoding="utf-8").read()
    return json.loads(s[s.index("{"):s.rindex("}") + 1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="gdufs-3d/north-data.js")
    ap.add_argument("--osm", default="artifacts/lock/osm_north2.json")
    ap.add_argument("--lon0", type=float, default=113.28631414)
    ap.add_argument("--lat0", type=float, default=23.20382514)
    ap.add_argument("--bbox", default="113.2815,23.1995,113.2905,23.2085")
    ap.add_argument("--aniso", action="store_true")
    ap.add_argument("--eps", type=float, default=2.0, help="膨胀半径 m，容忍平面图描边误差")
    ap.add_argument("--out", default="artifacts/lock/north_iou.json")
    a = ap.parse_args()

    lon0, lat0 = a.lon0, a.lat0
    kx = 111320.0 * np.cos(np.radians(lat0))
    lonA, latA, lonB, latB = [float(v) for v in a.bbox.split(",")]

    d = json.load(io.open(a.osm, encoding="utf-8"))
    osm_polys = []
    for e in d["elements"]:
        if e["type"] != "way" or not e.get("tags", {}).get("building"):
            continue
        g = e.get("geometry") or []
        if len(g) < 4:
            continue
        pts = [((p["lon"] - lon0) * kx, (p["lat"] - lat0) * KZ) for p in g]
        if len(set(pts)) < 3:
            continue
        poly = Polygon(pts).buffer(0)
        if poly.is_empty or poly.area < 40:
            continue
        c = poly.centroid
        if not ((lonA - lon0) * kx <= c.x <= (lonB - lon0) * kx
                and (latA - lat0) * KZ <= c.y <= (latB - lat0) * KZ):
            continue
        osm_polys.append(poly)
    osm_union = unary_union(osm_polys).buffer(a.eps)
    print("osm buildings: %d  area %.0f m2" % (len(osm_polys), osm_union.area))

    M = load_model(a.data)
    model_polys = []
    for b in M["buildings"]:
        rings = [[(-p[0], p[1]) for p in r] for r in b.get("rings", []) if len(r) >= 3]
        if not rings:
            continue
        poly = Polygon(rings[0]).buffer(0)
        if not poly.is_empty:
            model_polys.append(poly)
    m_area0 = sum(p.area for p in model_polys)
    print("model buildings: %d  area %.0f m2" % (len(model_polys), m_area0))

    def polys_of(par):
        if a.aniso:
            th, sx, sz, e0, n0 = par
        else:
            th, s, e0, n0 = par
            sx = sz = s
        c, sn = np.cos(np.radians(th)), np.sin(np.radians(th))
        return [affinity.affine_transform(p, [sx * c, -sz * sn, sx * sn, sz * c, e0, n0])
                for p in model_polys]

    def cost(par):
        if a.aniso:
            th, sx, sz, e0, n0 = par
            if not (0.6 < sx < 1.6 and 0.6 < sz < 1.6) or abs(th) > 25 or abs(e0) > 300 or abs(n0) > 300:
                return 1.0
        else:
            th, s, e0, n0 = par
            if not (0.6 < s < 1.6) or abs(th) > 25 or abs(e0) > 300 or abs(n0) > 300:
                return 1.0
        try:
            u = unary_union(polys_of(par))
        except Exception:
            return 1.0
        inter = u.intersection(osm_union).area
        union = u.area + osm_union.area - inter
        if union <= 0:
            return 1.0
        return 1.0 - inter / union

    x0 = np.array([0.0, 1.0, 1.0, 0.0, 0.0]) if a.aniso else np.array([0.0, 1.0, 0.0, 0.0])
    print("start cost %.4f (IoU %.3f)" % (cost(x0), 1 - cost(x0)))
    best = None
    starts = [x0]
    for dx in (-25, 0, 25):
        for dy in (-25, 0, 25):
            y = x0.copy()
            y[-2] += dx
            y[-1] += dy
            starts.append(y)
    for st in starts:
        res = minimize(cost, st, method="Powell",
                       options={"maxiter": 4000, "xtol": 1e-3, "ftol": 1e-5})
        if best is None or res.fun < best.fun:
            best = res
    res = best

    if a.aniso:
        th, sx, sz, e0, n0 = res.x
        print("best IoU %.4f  theta=%.3f  sx=%.4f sz=%.4f  dE=%+.1f dN=%+.1f"
              % (1 - res.fun, th, sx, sz, e0, n0))
    else:
        th, s, e0, n0 = res.x
        sx = sz = s
        print("best IoU %.4f  theta=%.3f  scale=%.4f  dE=%+.1f dN=%+.1f"
              % (1 - res.fun, th, s, e0, n0))

    lat_o = lat0 + n0 / KZ
    lon_o = lon0 + e0 / kx
    print("model origin -> lat=%.8f lon=%.8f" % (lat_o, lon_o))
    out = {"aniso": bool(a.aniso), "theta_deg": th, "sx": sx, "sz": sz, "dE": e0, "dN": n0,
           "iou": 1 - res.fun, "origin_wgs84": {"lat": lat_o, "lon": lon_o},
           "ref": {"lon0": lon0, "lat0": lat0}, "eps": a.eps}
    json.dump(out, io.open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("wrote " + a.out)


if __name__ == "__main__":
    main()
