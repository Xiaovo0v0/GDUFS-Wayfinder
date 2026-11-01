# -*- coding: utf-8 -*-
"""腾讯地图瓦片拼接（GCJ-02）。用于读取中文地名标注，定位校区。

layer=vec  : //rt{s}.map.gtimg.com/realtimerender?z={z}&x={x}&y={y}&type=vector&style=0  (带注记)
layer=sate : //p{s}.map.gtimg.com/sateTiles/{z}/{x16}/{y16}/{x}_{y}.jpg                (卫星，无注记)

坐标：输入 bbox 用 GCJ-02 经纬度；输出 png，并写 .json 记录像素↔GCJ 映射。
"""
import argparse
import json
import math
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

TILE = 256
SUBS = "0123"


def lonlat_to_px(lon, lat, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n * TILE
    s = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n * TILE
    return x, y


def px_to_lonlat(x, y, z):
    n = 2 ** z
    lon = x / (n * TILE) * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / (n * TILE)))))
    return lon, lat


def url_for(layer, z, x, y):
    s = SUBS[(x + y) % len(SUBS)]
    if layer == "amap":  # 高德路网注记（GCJ-02），style=8 为中文标准图
        return ("https://webrd0%d.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=%d&y=%d&z=%d"
                % ((x + y) % 4 + 1, x, y, z))
    if layer == "vec":
        return "https://rt%s.map.gtimg.com/realtimerender?z=%d&x=%d&y=%d&type=vector&style=0" % (s, z, x, y)
    return "https://p%s.map.gtimg.com/sateTiles/%d/%d/%d/%d_%d.jpg" % (s, z, x // 16, y // 16, x, y)


def fetch(layer, z, x, y, cache):
    p = os.path.join(cache, layer, str(z), str(x), "%d.png" % y)
    if os.path.exists(p) and os.path.getsize(p) > 200:
        return Image.open(p).convert("RGB")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    req = urllib.request.Request(url_for(layer, z, x, y), headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=30).read()
    with open(p, "wb") as f:
        f.write(data)
    return Image.open(BytesIO(data)).convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", required=True, help="GCJ-02 lon0,lat0,lon1,lat1")
    ap.add_argument("--z", type=int, default=17)
    ap.add_argument("--layer", default="vec", choices=["vec", "sate", "amap"])
    ap.add_argument("--out", required=True)
    ap.add_argument("--grid", type=int, default=0)
    ap.add_argument("--cache", default="artifacts/lock/tilecache")
    a = ap.parse_args()

    lon0, lat0, lon1, lat1 = [float(v) for v in a.bbox.split(",")]
    z = a.z
    x0f, y0f = lonlat_to_px(lon0, lat1, z)
    x1f, y1f = lonlat_to_px(lon1, lat0, z)
    tx0, ty0 = int(x0f // TILE), int(y0f // TILE)
    tx1, ty1 = int(x1f // TILE), int(y1f // TILE)
    ox, oy = tx0 * TILE, ty0 * TILE
    W, H = (tx1 - tx0 + 1) * TILE, (ty1 - ty0 + 1) * TILE
    jobs = [(x, y) for x in range(tx0, tx1 + 1) for y in range(ty0, ty1 + 1)]
    with ThreadPoolExecutor(max_workers=6) as ex:
        imgs = list(ex.map(lambda t: (t, fetch(a.layer, z, t[0], t[1], a.cache)), jobs))

    mos = Image.new("RGB", (W, H), (12, 12, 12))
    for (x, y), im in imgs:
        mos.paste(im, (x * TILE - ox, y * TILE - oy))
    cx0, cy0 = int(x0f - ox), int(y0f - oy)
    cx1, cy1 = int(x1f - ox), int(y1f - oy)
    mos = mos.crop((cx0, cy0, cx1, cy1))
    ox, oy = ox + cx0, oy + cy0

    m_per_px = 156543.03392 * math.cos(math.radians((lat0 + lat1) / 2)) / (2 ** z)
    draw = ImageDraw.Draw(mos)
    try:
        small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
    except Exception:
        small = ImageFont.load_default()
    if a.grid:
        step_px = a.grid / m_per_px
        n = 0
        gx = 0.0
        while gx < mos.width:
            draw.line([(gx, 0), (gx, mos.height)], fill=(255, 80, 0), width=1)
            gx += step_px
        gy = 0.0
        while gy < mos.height:
            draw.line([(0, gy), (mos.width, gy)], fill=(255, 80, 0), width=1)
            gy += step_px
    # 每 100px 标注 GCJ 经纬度
    for gx in range(0, mos.width, 300):
        lon, lat = px_to_lonlat(ox + gx, oy, z)
        draw.text((gx + 2, 2), "%.5f" % lon, fill=(0, 255, 255), font=small)
    for gy in range(0, mos.height, 300):
        lon, lat = px_to_lonlat(ox, oy + gy, z)
        draw.text((2, gy + 2), "%.5f" % lat, fill=(0, 255, 255), font=small)

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    mos.save(a.out)
    x_c, y_c = ox + mos.width / 2, oy + mos.height / 2
    clon, clat = px_to_lonlat(x_c, y_c, z)
    json.dump({"z": z, "w": mos.width, "h": mos.height, "center_gcj": [clon, clat], "m_per_px": m_per_px},
              open(a.out + ".json", "w"), indent=1)
    print("saved %s %dx%d gcj_center=%.6f,%.6f" % (a.out, mos.width, mos.height, clon, clat))


if __name__ == "__main__":
    main()
