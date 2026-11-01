# -*- coding: utf-8 -*-
"""无名称参与的配准：把 campus 模型的建筑多边形与 OSM 建筑 footprint 做连续代价拟合。

代价（对称、有界）：
  C1 = mean_i min(80, dist(模型建筑 i 的质心, OSM 建筑并集))^2     # 落在楼里 = 0
  C2 = mean_j min(80, dist(OSM 建筑 j 的质心, 模型建筑并集))^2
  cost = C1 + C2

参数：theta(deg) + sx + sz（模型米制 -> 真实米制，可分轴拉伸，吸收平面图非等比像素）
      + 平移 (dE, dN)。

用法:
  python tools/lock/register_north.py --aniso --bbox 113.2815,23.1995,113.2905,23.2085
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
    ap.add_argument("--lon0", type=float, default=113.28631)
    ap.add_argument("--lat0", type=float, default=23.20383)
    ap.add_argument("--bbox", default="113.2815,23.1995,113.2905,23.2085")
    ap.add_argument("--aniso", action="store_true")
    ap.add_argument("--out", default="artifacts/lock/north_reg.json")
    ap.add_argument("--iters", type=int, default=3000)
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
        # 只用校园范围附近的建筑
        if not ((lonA - lon0) * kx <= c.x <= (lonB - lon0) * kx
                and (latA - lat0) * KZ <= c.y <= (latB - lat0) * KZ):
            continue
        osm_polys.append(poly)
    osm_union = unary_union(osm_polys)
    osm_cent = [p.centroid for p in osm_polys]
    print("osm buildings: %d" % len(osm_polys))

    M = load_model(a.data)
    model_polys = []
    for b in M["buildings"]:
        rings = [[(-p[0], p[1]) for p in r] for r in b.get("rings", []) if len(r) >= 3]
        if not rings:
            continue
        poly = Polygon(rings[0]).buffer(0)
        if not poly.is_empty:
            model_polys.append(poly)
    model_cent = [p.centroid for p in model_polys]
    print("model buildings: %d" % len(model_polys))

    def transformed(par):
        if a.aniso:
            th, sx, sz, e0, n0 = par
        else:
            th, s, e0, n0 = par
            sx = sz = s
        c, sn = np.cos(np.radians(th)), np.sin(np.radians(th))
        # u,v -> (sx*u, sz*v) -> 旋转 -> 平移；写成 2x2 仿射矩阵
        A00, A01 = sx * c, -sz * sn
        A10, A11 = sx * sn, sz * c
        return [affinity.affine_transform(p, [A00, A01, A10, A11, e0, n0]) for p in model_polys]

    def cost(par):
        if a.aniso:
            th, sx, sz, e0, n0 = par
            if not (0.7 < sx < 1.4 and 0.7 < sz < 1.4):
                return 1e9
        else:
            th, s, e0, n0 = par
            if not (0.7 < s < 1.4):
                return 1e9
        polys = transformed(par)
        m_union = unary_union(polys)
        d1 = np.array([min(80.0, osm_union.distance(c)) for c in model_cent])
        d2 = np.array([min(80.0, m_union.distance(c)) for c in osm_cent])
        return float((d1 ** 2).mean() + (d2 ** 2).mean())

    if a.aniso:
        x0 = np.array([0.0, 1.0, 1.0, 0.0, 0.0])
    else:
        x0 = np.array([0.0, 1.0, 0.0, 0.0])
    print("start cost %.1f" % cost(x0))

    best = None
    for _ in range(3):
        res = minimize(cost, x0, method="Powell",
                       options={"maxiter": a.iters, "xtol": 1e-4, "ftol": 1e-4})
        if best is None or res.fun < best.fun:
            best = res
        x0 = res.x + np.array([0.3, 0.01, 0.01, 3.0, -3.0][:len(res.x)])
    res = best

    if a.aniso:
        th, sx, sz, e0, n0 = res.x
        print("best cost %.1f  theta=%.3f deg  sx=%.4f sz=%.4f  dE=%+.1f dN=%+.1f"
              % (res.fun, th, sx, sz, e0, n0))
    else:
        th, s, e0, n0 = res.x
        sx = sz = s
        print("best cost %.1f  theta=%.3f deg  scale=%.4f  dE=%+.1f dN=%+.1f"
              % (res.fun, th, s, e0, n0))

    polys = transformed(res.x)
    m_union = unary_union(polys)
    d1 = np.array([max(0.0, osm_union.distance(c)) for c in model_cent])
    inside = int((d1 == 0).sum())
    print("model centroids inside OSM building: %d/%d  median %.1f m  p90 %.1f m"
          % (inside, len(d1), np.median(d1), np.percentile(d1, 90)))

    lat_o = lat0 + n0 / KZ
    lon_o = lon0 + e0 / kx
    print("model origin -> lat=%.8f lon=%.8f" % (lat_o, lon_o))

    out = {"aniso": bool(a.aniso), "theta_deg": th, "sx": sx, "sz": sz,
           "dE": e0, "dN": n0, "origin_wgs84": {"lat": lat_o, "lon": lon_o},
           "cost": res.fun, "inside": inside, "n_model": len(polys),
           "median_m": float(np.median(d1)), "p90_m": float(np.percentile(d1, 90)),
           "ref": {"lon0": lon0, "lat0": lat0}}
    json.dump(out, io.open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("wrote " + a.out)


if __name__ == "__main__":
    main()
