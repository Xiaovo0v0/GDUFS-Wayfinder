# -*- coding: utf-8 -*-
"""拼接公开卫星影像瓦片（ArcGIS World Imagery，WGS84 无偏移），并绘制经纬网/米网格。

用法:
  python tools/lock/tiles.py --bbox 113.283,23.176,113.297,23.190 --z 18 --out artifacts/lock/north_sat.png --grid
  python tools/lock/tiles.py --bbox ... --overlay artifacts/lock/overlay.json

--overlay 是一个 JSON: {"polylines": [{"pts": [[lon,lat],...], "color": "#00ff00", "w": 3, "label": "..."}],
                          "points":  [{"lon":..,"lat":..,"color":"#ff0","label":"正门"}]}
"""
import argparse
import json
import math
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

TILE = 256
EQ_R = 6378137.0
URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"


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


def fetch(z, x, y, cache):
    p = os.path.join(cache, str(z), str(x), "%d.jpg" % y)
    if os.path.exists(p) and os.path.getsize(p) > 200:
        return Image.open(p).convert("RGB")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    last = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(URL.format(z=z, x=x, y=y),
                                         headers={"User-Agent": "gdufs-wayfinder/1.0"})
            data = urllib.request.urlopen(req, timeout=40).read()
            if len(data) < 200:
                raise IOError("short tile")
            with open(p, "wb") as f:
                f.write(data)
            return Image.open(BytesIO(data)).convert("RGB")
        except Exception as exc:  # 网络抖动/限流：退避重试
            last = exc
            time.sleep(1.5 * (attempt + 1))
    print("tile %d/%d/%d failed: %s" % (z, x, y, last))
    return Image.new("RGB", (TILE, TILE), (30, 30, 30))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", required=True, help="lon0,lat0,lon1,lat1")
    ap.add_argument("--z", type=int, default=18)
    ap.add_argument("--out", required=True)
    ap.add_argument("--grid", type=int, default=0, help="米网格间隔，0 表示不画")
    ap.add_argument("--overlay")
    ap.add_argument("--cache", default="artifacts/lock/tilecache")
    ap.add_argument("--title")
    a = ap.parse_args()

    lon0, lat0, lon1, lat1 = [float(v) for v in a.bbox.split(",")]
    z = a.z
    x0f, y0f = lonlat_to_px(lon0, lat1, z)   # 左上
    x1f, y1f = lonlat_to_px(lon1, lat0, z)   # 右下
    tx0, ty0 = int(math.floor(x0f / TILE)), int(math.floor(y0f / TILE))
    tx1, ty1 = int(math.floor(x1f / TILE)), int(math.floor(y1f / TILE))
    ox, oy = tx0 * TILE, ty0 * TILE
    W = (tx1 - tx0 + 1) * TILE
    H = (ty1 - ty0 + 1) * TILE

    jobs = [(x, y) for x in range(tx0, tx1 + 1) for y in range(ty0, ty1 + 1)]
    print("tiles %d (%dx%d)" % (len(jobs), tx1 - tx0 + 1, ty1 - ty0 + 1))
    with ThreadPoolExecutor(max_workers=8) as ex:
        imgs = list(ex.map(lambda t: (t, fetch(z, t[0], t[1], a.cache)), jobs))

    mos = Image.new("RGB", (W, H), (20, 20, 20))
    for (x, y), im in imgs:
        mos.paste(im, (x * TILE - ox, y * TILE - oy))

    # 裁到 bbox
    cx0, cy0 = int(round(x0f - ox)), int(round(y0f - oy))
    cx1, cy1 = int(round(x1f - ox)), int(round(y1f - oy))
    mos = mos.crop((cx0, cy0, cx1, cy1))
    ox, oy = ox + cx0, oy + cy0

    m_per_px = 156543.03392 * math.cos(math.radians((lat0 + lat1) / 2)) / (2 ** z) * (TILE / TILE)

    def to_px(lon, lat):
        xf, yf = lonlat_to_px(lon, lat, z)
        return xf - ox, yf - oy

    draw = ImageDraw.Draw(mos)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 16)
        small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
    except Exception:
        font = small = ImageFont.load_default()

    if a.grid:
        step = a.grid  # 米
        step_px = step / m_per_px
        lonA, latA = px_to_lonlat(ox, oy, z)
        # 从 bbox 西/南边界起画
        gx = 0
        while gx < mos.width:
            draw.line([(gx, 0), (gx, mos.height)], fill=(255, 255, 0, 90), width=1)
            gx += step_px
        gy = 0
        while gy < mos.height:
            draw.line([(0, gy), (mos.width, gy)], fill=(255, 255, 0, 90), width=1)
            gy += step_px
        # 标尺
        bar = int(round(100 / m_per_px))
        draw.rectangle([10, mos.height - 30, 10 + bar, mos.height - 24], fill=(255, 255, 255))
        draw.text((10, mos.height - 52), "100 m", fill=(255, 255, 255), font=small)

    _fonts = {}

    def _font(size):
        if size not in _fonts:
            try:
                _fonts[size] = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", size)
            except Exception:
                _fonts[size] = ImageFont.load_default()
        return _fonts[size]

    def _label(xy, text, color, size):
        draw.text(xy, text, fill=color, font=_font(int(size)),
                  stroke_width=3, stroke_fill=(0, 0, 0))

    specs = []
    for op in (a.overlay or "").split(","):
        op = op.strip()
        if op and os.path.exists(op):
            specs.append(json.load(open(op, encoding="utf-8")))
    for spec in specs:
        for pl in spec.get("polylines", []):
            pts = [to_px(*p) for p in pl["pts"]]
            draw.line(pts, fill=pl.get("color", "#00ff00"), width=pl.get("w", 3), joint="curve")
            if pl.get("label"):
                _label(pts[0], pl["label"], pl.get("color", "#00ff00"), pl.get("size", 13))
        for pt in spec.get("points", []):
            x, y = to_px(pt["lon"], pt["lat"])
            r = pt.get("r", 5)
            draw.ellipse([x - r, y - r, x + r, y + r], outline=pt.get("color", "#ffff00"), width=2)
            if pt.get("label"):
                _label((x + 7, y - 7), pt["label"], pt.get("color", "#ffff00"), pt.get("size", 13))

    # 角点经纬度
    txt = "z%d  %.3f m/px  W%.4f S%.4f E%.4f N%.4f" % (z, m_per_px, lon0, lat0, lon1, lat1)
    if a.title:
        txt = a.title + "  " + txt
    draw.rectangle([0, 0, min(mos.width, 14 + 9 * len(txt)), 24], fill=(0, 0, 0))
    draw.text((6, 4), txt, fill=(255, 255, 255), font=small)

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    mos.save(a.out)
    geo = {
        "z": z,
        "out": a.out,
        "w": mos.width,
        "h": mos.height,
        "px0_lon": px_to_lonlat(ox, oy, z)[0],
        "px0_lat": px_to_lonlat(ox, oy, z)[1],
        "m_per_px": m_per_px,
        "bbox": [lon0, lat0, lon1, lat1],
    }
    json.dump(geo, open(a.out + ".json", "w"), indent=1)
    print("saved %s %dx%d  %.3f m/px" % (a.out, mos.width, mos.height, m_per_px))


if __name__ == "__main__":
    main()
