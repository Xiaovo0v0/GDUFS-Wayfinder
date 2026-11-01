# -*- coding: utf-8 -*-
"""把几张叠图拼成一张交付用的对照图（带标题、面板说明、页脚）。"""
import io
import json
import os

from PIL import Image, ImageDraw, ImageFont

FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_B = "C:/Windows/Fonts/msyhbd.ttc"

PANELS = [
    ("artifacts/lock/north_final.png", "白云山校区（北）",
     "公开卫星影像 + 模型边界（青）/ 建筑（紫）", "WGS84 23.20386 N, 113.28632 E"),
    ("artifacts/lock/south_final.png", "大学城校区（南）",
     "同一套瓦片源，模型边界与建筑直接对上校园轮廓", "WGS84 23.06655 N, 113.39215 E"),
    ("artifacts/lock/two_campus.png", "两校区在全城的相对位置",
     "白云山校区在山脚，大学城校区在小谷围岛", "相距约 18.6 km"),
]

TITLE = "广外双校区锁定：用公开底图把 3D 校园模型钉到经纬度"
SUB = "底图：ArcGIS World Imagery（WGS84）· 参照：OSM 建筑/路网 + 高德注记 · 2026-11-01"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def main():
    H = 1400
    pad, gap = 40, 40
    cap_h = 84
    title_h = 108
    meta_h = 56
    foot_h = 64

    imgs = []
    for path, name, sub, meta in PANELS:
        im = Image.open(path).convert("RGB")
        w = int(im.width * H / im.height)
        im = im.resize((w, H), Image.LANCZOS)
        imgs.append((im, name, sub, meta))

    total_w = pad * 2 + sum(im.width for im, *_ in imgs) + gap * (len(imgs) - 1)
    total_h = title_h + cap_h + H + meta_h + foot_h
    sheet = Image.new("RGB", (total_w, total_h), (12, 14, 18))
    d = ImageDraw.Draw(sheet)

    d.rectangle([0, 0, total_w, title_h], fill=(10, 12, 16))
    d.text((pad, 22), TITLE, fill=(255, 255, 255), font=font(FONT_B, 34))
    d.text((pad, 68), SUB, fill=(140, 152, 170), font=font(FONT, 20))

    x = pad
    for im, name, sub, meta in imgs:
        d.rectangle([x, title_h, x + im.width, title_h + cap_h], fill=(20, 24, 30))
        d.text((x + 12, title_h + 8), name, fill=(255, 255, 255), font=font(FONT_B, 26))
        d.text((x + 12, title_h + 44), sub, fill=(150, 162, 180), font=font(FONT, 18))
        sheet.paste(im, (x, title_h + cap_h))
        d.rectangle([x, title_h + cap_h, x + im.width, title_h + cap_h + H],
                    outline=(60, 70, 85), width=2)
        d.text((x + 12, title_h + cap_h + H + 12), meta, fill=(120, 200, 240),
               font=font(FONT, 20))
        x += im.width + gap

    d.rectangle([0, total_h - foot_h, total_w, total_h], fill=(10, 12, 16))
    d.text((pad, total_h - foot_h + 20),
           "青线＝模型校园边界　紫线＝模型建筑　绿字＝OSM 注记　红线＝模型校门　"
           "北校残差中位数约 39 m（平面图为示意图所致），南校残差中位数 0.4 m。",
           fill=(160, 170, 185), font=font(FONT, 20))

    out = "artifacts/lock/two_campus_sheet.png"
    sheet.save(out)
    print("saved %s %dx%d" % (out, sheet.width, sheet.height))


if __name__ == "__main__":
    main()
