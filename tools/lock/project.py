# -*- coding: utf-8 -*-
"""把 campus 模型（本地米制坐标）投到经纬度，输出 tiles.py 能吃的 overlay JSON。

用法:
  python tools/lock/project.py --data gdufs-3d/north-data.js \
      --lat 23.20383 --lon 113.28631 --out artifacts/lock/overlay_north.json

坐标约定：x=西向(m), z=北向(m)。先换成 ENU（E=-x, N=z），再按 --rot 顺时针旋转、
按 --scale 缩放，最后用 geo.js 同样的球面近似换成经纬度。
"""
import argparse
import io
import json
import math

KZ = 110540.0


def load(path):
    s = io.open(path, encoding="utf-8").read()
    return json.loads(s[s.index("{"):s.rindex("}") + 1])


def _centroid(rings):
    if not rings:
        return 0.0, 0.0
    pts = rings[0]
    a = cx = cy = 0.0
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        cr = x0 * y1 - x1 * y0
        a += cr
        cx += (x0 + x1) * cr
        cy += (y0 + y1) * cr
    if abs(a) < 1e-9:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    a *= 0.5
    return cx / (6 * a), cy / (6 * a)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="gdufs-3d/north-data.js")
    ap.add_argument("--lat", type=float)
    ap.add_argument("--lon", type=float)
    ap.add_argument("--rot", type=float, default=0.0, help="顺时针角度，度")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--sx", type=float, default=None, help="东西向单独拉伸（吸收平面图非等比像素）")
    ap.add_argument("--sz", type=float, default=None)
    ap.add_argument("--out", required=True)
    ap.add_argument("--labels", type=int, default=1)
    ap.add_argument("--buildings", type=int, default=1)
    a = ap.parse_args()

    M = load(a.data)
    meta = M.get("meta", {})
    o = meta.get("origin_wgs84") or {}
    lat0 = a.lat if a.lat is not None else o.get("lat")
    lon0 = a.lon if a.lon is not None else o.get("lon")
    if lat0 is None or lon0 is None:
        raise SystemExit("no origin: pass --lat/--lon")
    kx = 111320.0 * math.cos(math.radians(lat0))
    c = math.cos(math.radians(a.rot))
    s = math.sin(math.radians(a.rot))
    sx = a.sx if a.sx is not None else a.scale
    sz = a.sz if a.sz is not None else a.scale

    def ll(x, z):
        e0 = -x * sx
        n0 = z * sz
        e = e0 * c - n0 * s
        n = e0 * s + n0 * c
        return [lon0 + e / kx, lat0 + n / KZ]

    polys, points = [], []

    if a.buildings:
        for b in M.get("buildings", []):
            col = {"teaching": "#ff4fd8", "dorm": "#7dd3fc", "admin": "#fb923c"}.get(
                b.get("type"), "#e879f9")
            for ring in b.get("rings", []):
                polys.append({"pts": [ll(*p) for p in ring], "color": col, "w": 2})
            if a.labels and b.get("name"):
                cx, cz = b.get("centroid") or _centroid(b.get("rings") or [])
                lon, lat = ll(cx, cz)
                points.append({"lon": lon, "lat": lat, "color": "#ffffff",
                               "r": 1, "label": b["name"]})

    for ring in M.get("boundary", []):
        polys.append({"pts": [ll(*p) for p in ring], "color": "#00ffe7", "w": 4})

    # 水体 / 操场
    for wp in M.get("waterPolygons", []):
        for ring in wp.get("rings", []):
            polys.append({"pts": [ll(*p) for p in ring], "color": "#38bdf8", "w": 2})
    for ls in M.get("landscape", []):
        for ring in ls.get("rings", []):
            if len(ring) < 3:
                continue
            col = "#facc15" if ls.get("pitch") or ls.get("sport") else "#4ade80"
            polys.append({"pts": [ll(*p) for p in ring], "color": col, "w": 2})

    for r in M.get("roads", []):
        for line in r.get("lines", []):
            if len(line) < 2:
                continue
            polys.append({"pts": [ll(*p) for p in line], "color": "#ffe066", "w": 1})

    for g in M.get("gates", []):
        lon, lat = ll(g["x"], g["z"])
        points.append({"lon": lon, "lat": lat, "color": "#ff2d2d", "r": 6,
                       "label": "GATE " + str(g.get("name", ""))})

    spec = {"polylines": polys, "points": points}
    json.dump(spec, io.open(a.out, "w", encoding="utf-8"), ensure_ascii=False)
    print("wrote %s  polys=%d points=%d  origin %.6f,%.6f rot=%.2f scale=%.4f"
          % (a.out, len(polys), len(points), lat0, lon0, a.rot, a.scale))


if __name__ == "__main__":
    main()
