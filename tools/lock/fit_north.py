# -*- coding: utf-8 -*-
"""用 OSM 的 WGS84 建筑质心，拟合 north-data.js 的局部坐标系 -> 经纬度。

模型坐标约定（见 tools/align_north_plan.py 与 geo.js）：
    x = 西向(m)，z = 北向(m)
    lon = lon0 - x / (111320*cos(lat0))
    lat = lat0 + z / 110540

输出：origin_wgs84 = (lat0, lon0)，以及每个匹配建筑的残差（米）。
"""
import io
import json
import math
import sys

DATA = "gdufs-3d/north-data.js"
OSM = "artifacts/lock/osm_north2.json"

KZ = 110540.0
KX_OF = lambda lat: 111320.0 * math.cos(math.radians(lat))

# 模型名称 -> OSM 名称候选（同名直接匹配，这里只列别名）
ALIAS = {
    "行政楼": ["行政办公楼"],
    "第六教学楼": ["第六教学楼"],
    "图书馆": ["图书馆"],
    "门诊部": ["校医院", "门诊部"],
    "保卫处": ["保卫处"],
    "第一学生食堂": ["第一食堂", "第一学生食堂"],
    "第二学生食堂": ["第二食堂", "第二学生食堂"],
}


def load_model():
    s = io.open(DATA, encoding="utf-8").read()
    return json.loads(s[s.index("{"):s.rindex("}") + 1])


def load_osm():
    d = json.load(io.open(OSM, encoding="utf-8"))
    out = {}
    for e in d["elements"]:
        n = e.get("tags", {}).get("name")
        if not n:
            continue
        g = e.get("geometry") or []
        if not g:
            continue
        lat = sum(p["lat"] for p in g) / len(g)
        lon = sum(p["lon"] for p in g) / len(g)
        # 同名取第一个；建筑优先
        if n not in out or e["tags"].get("building"):
            out[n] = (lat, lon, e["tags"])
    return out


def main():
    M = load_model()
    O = load_osm()
    pairs = []
    for b in M["buildings"]:
        nm = b.get("name")
        if not nm:
            continue
        cands = [nm] + ALIAS.get(nm, [])
        for c in cands:
            if c in O:
                lat, lon, tags = O[c]
                pairs.append((nm, b["centroid"][0], b["centroid"][1], lat, lon))
                break

    print("matched %d buildings" % len(pairs))
    for p in pairs:
        print("  %-12s x=%7.1f z=%7.1f  osm=%.6f,%.6f" % p)

    if len(pairs) < 2:
        print("not enough pairs")
        return

    # 1) 固定尺度、无旋转：解 lat0/lon0
    lat0s, lon0s = [], []
    for nm, x, z, lat, lon in pairs:
        lat0s.append(lat - z / KZ)
        lon0s.append(lon + x / (111320.0 * math.cos(math.radians(lat))))
    lat0 = sum(lat0s) / len(lat0s)
    lon0 = sum(lon0s) / len(lon0s)
    print("\nfixed-scale origin: lat0=%.8f lon0=%.8f" % (lat0, lon0))
    print("  spread lat0 %.4f m, lon0 %.4f m" % (
        (max(lat0s) - min(lat0s)) * KZ, (max(lon0s) - min(lon0s)) * KX_OF(lat0)))
    res = []
    for nm, x, z, lat, lon in pairs:
        plat = lat0 + z / KZ
        plon = lon0 - x / KX_OF(lat0)
        de = (lon - plon) * KX_OF(lat0)
        dn = (lat - plat) * KZ
        res.append(math.hypot(de, dn))
        print("  %-12s residual  dE=%+6.1f m dN=%+6.1f m  |%.1f|" % (nm, de, dn, math.hypot(de, dn)))
    print("  mean |res| = %.1f m, max %.1f m" % (sum(res) / len(res), max(res)))

    # 2) 相似变换（含旋转/尺度），最小二乘 Umeyama，局部 ENU 上做
    #    模型 (x,z) -> ENU (E,N) ，其中 E = -x, N = z
    enu = [(-x, z) for _, x, z, _, _ in pairs]
    ref = [((lon - lon0) * KX_OF(lat0), (lat - lat0) * KZ) for _, _, _, lat, lon in pairs]
    n = len(pairs)
    mu_m = (sum(p[0] for p in enu) / n, sum(p[1] for p in enu) / n)
    mu_r = (sum(p[0] for p in ref) / n, sum(p[1] for p in ref) / n)
    sxx = sxy = syx = syy = 0.0
    for (mx, my), (rx, ry) in zip(enu, ref):
        ax, ay = mx - mu_m[0], my - mu_m[1]
        bx, by = rx - mu_r[0], ry - mu_r[1]
        sxx += ax * bx
        sxy += ax * by
        syx += ay * bx
        syy += ay * by
    var_m = sum((p[0] - mu_m[0]) ** 2 + (p[1] - mu_m[1]) ** 2 for p in enu) / n
    # 2x2 拟合： ref = R * enu * s + t
    a = (sxx + syy) / n / var_m
    b = (syx - sxy) / n / var_m
    scale = math.hypot(a, b)
    rot = math.degrees(math.atan2(b, a))  # 逆时针为正（x 东, y 北）
    tx = mu_r[0] - (a * mu_m[0] - b * mu_m[1])
    ty = mu_r[1] - (b * mu_m[0] + a * mu_m[1])
    print("\nsimilarity: scale=%.5f rot=%.3f deg" % (scale, rot))
    r2 = []
    for (mx, my), (rx, ry), p in zip(enu, ref, pairs):
        ex = a * mx - b * my + tx
        ey = b * mx + a * my + ty
        r2.append(math.hypot(ex - rx, ey - ry))
    print("  mean residual %.1f m, max %.1f m" % (sum(r2) / n, max(r2)))

    # 反算 origin（考虑旋转/尺度）：模型原点 (x=0,z=0) -> ENU(0,0)
    ox = tx
    oy = ty
    olon = lon0 + ox / KX_OF(lat0)
    olat = lat0 + oy / KZ
    print("\nmodel origin (0,0) -> lat=%.8f lon=%.8f  (rotation %.3f deg, scale %.5f)" % (olat, olon, rot, scale))

    out = {
        "pairs": [{"name": p[0], "x": p[1], "z": p[2], "lat": p[3], "lon": p[4]} for p in pairs],
        "origin_fixed_scale": {"lat": lat0, "lon": lon0},
        "similarity": {"scale": scale, "rot_deg": rot, "tx_m": tx, "ty_m": ty},
        "origin_similarity": {"lat": olat, "lon": olon},
        "residuals_fixed": res,
        "residuals_similarity": r2,
    }
    json.dump(out, io.open("artifacts/lock/north_fit.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nwrote artifacts/lock/north_fit.json")


if __name__ == "__main__":
    main()
