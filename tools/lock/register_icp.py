# -*- coding: utf-8 -*-
"""路网 ICP 配准：把模型的路网折线对齐到 OSM 路网，解 theta/scale/平移。

比建筑质心稳：道路是长线性要素，采样点多，少量错误匹配可以被截尾处理掉。
用 scipy.spatial.cKDTree 找最近邻，裁剪掉最差的一批对应点后做 Umeyama 相似变换。

用法:
  python tools/lock/register_icp.py --data gdufs-3d/north-data.js \
      --osm artifacts/lock/osm_north2.json --lat0 23.20382514 --lon0 113.28631414 \
      --out artifacts/lock/north_icp.json
"""
import argparse
import io
import json

import numpy as np
from scipy.spatial import cKDTree

KZ = 110540.0


def load_model(path):
    s = io.open(path, encoding="utf-8").read()
    return json.loads(s[s.index("{"):s.rindex("}") + 1])


def densify(pts, step=4.0):
    out = []
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        d = np.hypot(x1 - x0, y1 - y0)
        n = max(1, int(d / step))
        for k in range(n):
            t = k / n
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    if pts:
        out.append(tuple(pts[-1]))
    return out


def umeyama(src, dst, with_scale=True):
    """src -> dst 的相似变换（2D），返回 (s, R(2x2), t)。"""
    mu_s, mu_d = src.mean(0), dst.mean(0)
    S, D = src - mu_s, dst - mu_d
    cov = D.T @ S / len(src)
    U, sig, Vt = np.linalg.svd(cov)
    Sm = np.eye(2)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0:
        Sm[1, 1] = -1
    R = U @ Sm @ Vt
    var = (S ** 2).sum() / len(src)
    s = float(np.trace(np.diag(sig) @ Sm) / var) if with_scale else 1.0
    t = mu_d - s * R @ mu_s
    return s, R, t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="gdufs-3d/north-data.js")
    ap.add_argument("--osm", default="artifacts/lock/osm_north2.json")
    ap.add_argument("--lat0", type=float, default=23.20382514)
    ap.add_argument("--lon0", type=float, default=113.28631414)
    ap.add_argument("--bbox", default="113.2815,23.1995,113.2905,23.2085")
    ap.add_argument("--keep", type=float, default=0.7, help="每轮保留最近的比例")
    ap.add_argument("--iters", type=int, default=40)
    ap.add_argument("--fix-rot", action="store_true", help="锁死旋转（产品侧 geo.js 只能做纯平移）")
    ap.add_argument("--fix-scale", action="store_true", help="锁死尺度")
    ap.add_argument("--out", default="artifacts/lock/north_icp.json")
    a = ap.parse_args()

    lon0, lat0 = a.lon0, a.lat0
    kx = 111320.0 * np.cos(np.radians(lat0))
    lonA, latA, lonB, latB = [float(v) for v in a.bbox.split(",")]

    # --- OSM 路网采样
    d = json.load(io.open(a.osm, encoding="utf-8"))
    ref = []
    for e in d["elements"]:
        if e["type"] != "way" or not e.get("tags", {}).get("highway"):
            continue
        g = e.get("geometry") or []
        if len(g) < 2:
            continue
        pts = [((p["lon"] - lon0) * kx, (p["lat"] - lat0) * KZ) for p in g]
        if not any((lonA - lon0) * kx <= x <= (lonB - lon0) * kx
                   and (latA - lat0) * KZ <= y <= (latB - lat0) * KZ for x, y in pts):
            continue
        ref.extend(densify(pts))
    ref = np.array(ref)
    print("osm road samples: %d" % len(ref))
    tree = cKDTree(ref)

    # --- 模型路网：x=西向 -> E=-x, N=z
    M = load_model(a.data)
    src = []
    for r in M.get("roads", []):
        for line in r.get("lines", []):
            if len(line) >= 2:
                src.extend(densify([(-p[0], p[1]) for p in line]))
    src = np.array(src)
    print("model road samples: %d" % len(src))

    # --- ICP ------------------------------------------------
    th, s = 0.0, 1.0
    t = np.zeros(2)
    hist = []
    for it in range(a.iters):
        R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
        P = s * (src @ R.T) + t
        dist, idx = tree.query(P, k=1)
        keep = dist <= np.percentile(dist, a.keep * 100)
        ns, nR, nt = umeyama(P[keep], ref[idx[keep]], with_scale=not a.fix_scale)
        if a.fix_rot:
            ang = 0.0
            nR = np.eye(2)
            # 纯平移：直接取对应点位移均值
            nt = (ref[idx[keep]] - P[keep]).mean(0)
            ns = 1.0
        else:
            ang = float(np.arctan2(nR[1, 0], nR[0, 0]))
        # 累计变换：P -> ns*nR*P + nt
        th = th + ang
        s = s * ns
        t = ns * (nR @ t) + nt
        med = float(np.median(dist[keep]))
        hist.append(med)
        if it > 3 and abs(hist[-2] - med) < 0.01:
            break
    R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
    P = s * (src @ R.T) + t
    dist, idx = tree.query(P, k=1)
    print("iters %d  median %.2f m  p75 %.2f m  mean %.2f m"
          % (it + 1, np.median(dist), np.percentile(dist, 75), dist.mean()))
    print("theta=%.4f deg  scale=%.5f  t=(%+.2f, %+.2f)" % (np.degrees(th), s, t[0], t[1]))

    lat_o = lat0 + t[1] / KZ
    lon_o = lon0 + t[0] / kx
    print("model origin -> lat=%.8f lon=%.8f" % (lat_o, lon_o))

    json.dump({"theta_deg": float(np.degrees(th)), "scale": s,
               "dE": float(t[0]), "dN": float(t[1]),
               "origin_wgs84": {"lat": lat_o, "lon": lon_o},
               "median_m": float(np.median(dist)), "p75_m": float(np.percentile(dist, 75)),
               "n_src": len(src), "n_ref": len(ref),
               "ref": {"lon0": lon0, "lat0": lat0}},
              io.open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("wrote " + a.out)


if __name__ == "__main__":
    main()
