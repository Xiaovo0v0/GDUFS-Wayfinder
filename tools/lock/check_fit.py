# -*- coding: utf-8 -*-
"""用一组已解好的变换（ICP / IoU / 手调）去检验：模型建筑质心 vs OSM 同名建筑的残差。

用法:
  python tools/lock/check_fit.py --xform artifacts/lock/north_icp.json
  python tools/lock/check_fit.py --lat0 23.2038 --lon0 113.2863 --theta 0 --scale 1
"""
import argparse
import io
import json
import math

KZ = 110540.0

ALIAS = {
    "行政楼": ["行政办公楼"],
    "第六教学楼": ["第六教学楼"],
    "第三教学楼": ["第三教学楼"],
    "第四教学楼": ["第四教学楼"],
    "第七教学楼": ["第七教学楼"],
    "第一学生食堂": ["第一食堂"],
    "第二学生食堂": ["第二食堂"],
    "干训楼": ["干训楼"],
    "图书馆": ["图书馆"],
    "门诊部": ["校医院"],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="gdufs-3d/north-data.js")
    ap.add_argument("--osm", default="artifacts/lock/osm_north2.json")
    ap.add_argument("--xform")
    ap.add_argument("--lat0", type=float)
    ap.add_argument("--lon0", type=float)
    ap.add_argument("--theta", type=float, default=0.0)
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--dx", type=float, default=0.0, help="东向平移 m")
    ap.add_argument("--dy", type=float, default=0.0, help="北向平移 m")
    a = ap.parse_args()

    if a.xform:
        x = json.load(io.open(a.xform, encoding="utf-8"))
        lat0 = x["origin_wgs84"]["lat"]
        lon0 = x["origin_wgs84"]["lon"]
        th = x.get("theta_deg", 0.0)
        s = x.get("scale", 1.0)
        dx = x.get("dE", 0.0)
        dy = x.get("dN", 0.0)
    else:
        lat0, lon0 = a.lat0, a.lon0
        th, s, dx, dy = a.theta, a.scale, a.dx, a.dy

    kx = 111320.0 * math.cos(math.radians(lat0))
    c, sn = math.cos(math.radians(th)), math.sin(math.radians(th))

    def ll(x_, z_):
        u, v = -x_ * s, z_ * s
        e = u * c - v * sn + dx
        n = u * sn + v * c + dy
        return lon0 + e / kx, lat0 + n / KZ

    d = json.load(io.open(a.osm, encoding="utf-8"))
    osm = {}
    for e in d["elements"]:
        t = e.get("tags", {})
        nm = t.get("name")
        g = e.get("geometry") or []
        if not nm or not g:
            continue
        if t.get("building") and nm not in osm:
            osm[nm] = (sum(p["lat"] for p in g) / len(g), sum(p["lon"] for p in g) / len(g))
    s_ = io.open(a.data, encoding="utf-8").read()
    M = json.loads(s_[s_.index("{"):s_.rindex("}") + 1])

    rows = []
    for b in M["buildings"]:
        nm = b.get("name")
        if not nm:
            continue
        for cand in [nm] + ALIAS.get(nm, []):
            if cand in osm:
                ola, olo = osm[cand]
                cx, cz = b["centroid"]
                plo, pla = ll(cx, cz)
                de = (olo - plo) * kx
                dn = (ola - pla) * KZ
                rows.append((nm, de, dn, math.hypot(de, dn)))
                break

    print("%-12s %8s %8s %8s" % ("name", "dE", "dN", "|d|"))
    for nm, de, dn, m in sorted(rows, key=lambda r: -r[3]):
        print("%-12s %+8.1f %+8.1f %8.1f" % (nm, de, dn, m))
    errs = [r[3] for r in rows]
    if errs:
        mean = sum(errs) / len(errs)
        med = sorted(errs)[len(errs) // 2]
        print("n=%d  mean %.1f m  median %.1f m  max %.1f m" % (len(errs), mean, med, max(errs)))
        print("mean dE %+.1f  mean dN %+.1f" % (sum(r[1] for r in rows) / len(rows),
                                                sum(r[2] for r in rows) / len(rows)))


if __name__ == "__main__":
    main()
