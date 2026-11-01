# -*- coding: utf-8 -*-
"""探测公开瓦片/POI 接口能不能吐出建筑名（腾讯矢量瓦片、高德、天地图）。"""
import json
import math
import urllib.request

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Referer": "https://map.jiqrxx.com/",
}

SITES = {
    "north": (23.20385672, 113.28631562),
    "south": (23.06655435, 113.39215490),
}


def tile(lat, lon, z):
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    lr = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lr)) / math.pi) / 2.0 * n)
    return z, x, y


def get(url, limit=260):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read()
            ct = r.headers.get("Content-Type", "")
            return r.status, ct, len(raw), raw[:limit]
    except Exception as e:
        return "ERR", type(e).__name__, 0, str(e)[:limit].encode("utf-8", "replace")


def main():
    for name, (lat, lon) in SITES.items():
        z, x, y = tile(lat, lon, 18)
        print("=== %s z%d x%d y%d  (tms y=%d)" % (name, z, x, y, 2 ** z - 1 - y))
        cands = [
            ("qq tile json", "https://rt0.map.gtimg.com/tile?z=%d&x=%d&y=%d&styleid=3&v=1.0" % (z, x, y)),
            ("qq tile tms", "https://rt0.map.gtimg.com/tile?z=%d&x=%d&y=%d&styleid=3&v=1.0" % (z, x, 2 ** z - 1 - y)),
            ("qq realtime", "https://rt0.map.gtimg.com/realtimerender?type=vector&style=0&v=1.0&z=%d&x=%d&y=%d" % (z, x, y)),
            ("qq vector tms", "https://rt0.map.gtimg.com/realtimerender?type=vector&style=0&v=1.0&z=%d&x=%d&y=%d" % (z, x, 2 ** z - 1 - y)),
            ("qq poi json", "https://apis.map.qq.com/ws/place/v1/search?boundary=nearby(%f,%f,800)&keyword=%s&key=%s"
             % (lat, lon, "%E6%95%99%E5%AD%A6%E6%A5%BC", "OB4Z-NZ2WX-4L64X-7L6XZ-6L6XZ-6L6XZ")),
        ]
        for tag, url in cands:
            st, ct, n, head = get(url)
            print("  %-14s %s %s %s  %r" % (tag, st, ct, n, head[:120]))


if __name__ == "__main__":
    main()
