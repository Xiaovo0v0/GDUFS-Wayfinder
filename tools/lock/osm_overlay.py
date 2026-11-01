# -*- coding: utf-8 -*-
"""把 OSM 建筑 footprint 以折线形式写进 overlay，用来和模型多边形同图对比。"""
import argparse
import io
import json

KZ = 110540.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", default="artifacts/lock/osm_north2.json")
    ap.add_argument("--bbox", default="113.2815,23.1995,113.2905,23.2085")
    ap.add_argument("--out", default="artifacts/lock/overlay_osm_north.json")
    ap.add_argument("--color", default="#22d3ee")
    ap.add_argument("--labels", type=int, default=1, help="0 = 不写楼名（图面太挤时用）")
    a = ap.parse_args()
    lonA, latA, lonB, latB = [float(v) for v in a.bbox.split(",")]
    d = json.load(io.open(a.osm, encoding="utf-8"))
    polys, points = [], []
    for e in d["elements"]:
        if e["type"] != "way":
            continue
        g = e.get("geometry") or []
        if len(g) < 3:
            continue
        lat = sum(p["lat"] for p in g) / len(g)
        lon = sum(p["lon"] for p in g) / len(g)
        if not (lonA < lon < lonB and latA < lat < latB):
            continue
        if not e.get("tags", {}).get("building"):
            continue
        pts = [[round(p["lon"], 7), round(p["lat"], 7)] for p in g]
        if pts[0] != pts[-1]:
            pts.append(pts[0])
        polys.append({"pts": pts, "color": a.color, "w": 2})
        nm = e["tags"].get("name")
        if nm and a.labels:
            points.append({"lon": lon, "lat": lat, "color": "#00ff00", "r": 1, "label": nm})
    json.dump({"polylines": polys, "points": points}, io.open(a.out, "w", encoding="utf-8"),
              ensure_ascii=False)
    print("wrote %s polys=%d names=%d" % (a.out, len(polys), len(points)))


if __name__ == "__main__":
    main()
