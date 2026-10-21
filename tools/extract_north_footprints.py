"""从官方北校区平面图提取建筑轮廓 → 局部米制坐标 JSON。

思路：
  1) 裁掉左侧绿色标题栏，缩到 2400 宽
  2) 绿色掩膜 → 填洞 → 校园范围
  3) 校园内的白色连通域 = 建筑
  4) 用操场跑道标定比例（标准 400 m 跑道外廓约 188 x 110 m）
  5) Moore 邻域边界跟踪取轮廓 → shapely 简化 → 米制坐标

坐标约定与南校一致：x = 西为正，z = 北为正，单位米，原点取校园质心。
输出 data/official/north_buildings.json 与编号调试图 artifacts/north/numbered.png
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from shapely.geometry import Polygon

SRC = r"data\official\_raw\campus_map_北校.jpg"
OUT_DIR = r"artifacts\north"
JSON_OUT = r"data\official\north_buildings.json"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(os.path.dirname(JSON_OUT), exist_ok=True)

im = Image.open(SRC).convert("RGB")
W0, H0 = im.size
im = im.crop((int(W0 * 0.13), 0, W0, H0))
TARGET_W = 2400
im = im.resize((TARGET_W, int(im.height * TARGET_W / im.width)), Image.LANCZOS)
W, H = im.size
a = np.asarray(im).astype(np.int16)
R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]

green = (G > R + 8) & (G > B + 8) & (G > 60)
green = ndimage.binary_closing(green, np.ones((5, 5)))
green = ndimage.binary_fill_holes(green)
green = ndimage.binary_opening(green, np.ones((7, 7)))

white = (R > 222) & (G > 222) & (B > 214)
white = white & green
white = ndimage.binary_opening(white, np.ones((3, 3)))
white = ndimage.binary_closing(white, np.ones((3, 3)))

# ---------- 用跑道标定比例 ----------
red = (R > 150) & (R > G + 45) & (R > B + 45)
red = ndimage.binary_closing(red, np.ones((5, 5)))
rlab, rn = ndimage.label(red)
rsz = ndimage.sum(red, rlab, range(1, rn + 1))
k = int(np.argmax(rsz)) + 1
ys, xs = np.where(rlab == k)
track_long = max(xs.max() - xs.min(), ys.max() - ys.min())
# 400 m 跑道（8 道）外廓长轴约 188 m
M_PER_PX = 188.0 / track_long
print("跑道长轴 %d px -> %.4f m/px" % (track_long, M_PER_PX))

# ---------- 轮廓提取（matplotlib marching squares，稳且快） ----------
import matplotlib
matplotlib.use("Agg")
from matplotlib import pyplot as plt


def contour_of(comp):
    """返回组件外轮廓的像素坐标 [(x, y), ...]；取最长的那条闭合曲线。"""
    ys, xs = np.where(comp)
    if len(ys) == 0:
        return []
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    sub = comp[y0:y1 + 1, x0:x1 + 1].astype(np.float32)
    sub = np.pad(sub, 1)                      # 避免轮廓贴边被截断
    cs = plt.contour(sub, levels=[0.5])
    try:
        segs = cs.allsegs[0]
    except Exception:
        segs = [p.vertices for c in cs.collections for p in c.get_paths()]
    plt.close()
    arrs = []
    for s in segs:
        v = getattr(s, "vertices", s)
        if v is None or len(v) < 4:
            continue
        arrs.append(np.asarray(v))
    if not arrs:
        return []
    best = max(arrs, key=len)
    # marching squares 的坐标是 (列, 行) 浮点；补了 1 px 的 pad，减回去
    return [(float(p[0]) + x0 - 1.0, float(p[1]) + y0 - 1.0) for p in best]


lab, n = ndimage.label(white)
print("连通域", n)

# 校园质心（用于原点）
bys, bxs = np.where(green)
cx, cy = bxs.mean(), bys.mean()

MIN_AREA_M2 = 120.0
items = []
for i in range(1, n + 1):
    comp = (lab == i)
    area_px = int(comp.sum())
    if area_px * M_PER_PX * M_PER_PX < MIN_AREA_M2:
        continue
    ys, xs = np.where(comp)
    if xs.min() <= 1 or ys.min() <= 1 or xs.max() >= W - 2 or ys.max() >= H - 2:
        continue
    ring = contour_of(comp)
    if len(ring) < 4:
        continue
    # 像素 -> 米（x 西为正 => 取负；z 北为正 => y 取负）
    pts_m = [((-(x - cx)) * M_PER_PX, (-(y - cy)) * M_PER_PX) for x, y in ring]
    if len(pts_m) < 4 or len(set(pts_m)) < 3:
        continue
    try:
        poly = Polygon(pts_m)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.is_empty:
            continue
    except Exception as exc:
        print("  跳过 #%d（轮廓异常：%s）" % (i, exc))
        continue
    if poly.geom_type == "MultiPolygon":
        poly = max(poly.geoms, key=lambda g: g.area)
    if poly.geom_type != "Polygon" or poly.area <= 0:
        continue
    poly = poly.simplify(1.1, preserve_topology=True)
    ring_m = [[round(px, 1), round(pz, 1)] for px, pz in poly.exterior.coords]
    if len(ring_m) < 4:
        continue
    area_m2 = poly.area
    minx, miny, maxx, maxy = poly.bounds
    items.append({
        "index": len(items) + 1,
        "ring": ring_m,
        "area": round(area_m2, 1),
        "centroid": [round(poly.centroid.x, 1), round(poly.centroid.y, 1)],
        "bbox": [round(minx, 1), round(miny, 1), round(maxx, 1), round(maxy, 1)],
        "px_area": area_px,
    })

items.sort(key=lambda d: -d["area"])
for i, it in enumerate(items):
    it["index"] = i + 1

print("保留建筑", len(items))
total = sum(it["area"] for it in items)
print("总基底面积 %.0f m2" % total)

data = {
    "meta": {
        "campus": "north",
        "name": "广东外语外贸大学 白云山校区（北校区）",
        "source": "学校官方《北校区平面图》(10488x8787)",
        "scale_m_per_px": round(M_PER_PX, 5),
        "calibration": "400 m 田径场外廓长轴标定",
        "crs_local": "x=西向(m), z=北向(m), 原点=校园质心",
        "note": "轮廓来自官方平面图矢量化；层数/高度未在图中标注，按建筑类型推定",
        "count": len(items),
    },
    "buildings": items,
}

with open(JSON_OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

# ---------- 编号调试图 ----------
dbg = im.copy()
d = ImageDraw.Draw(dbg)
try:
    from PIL import ImageFont
    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 26)
except Exception:
    font = None

for it in items:
    ring = it["ring"]
    px = [((-p[0]) / M_PER_PX + cx, (-p[1]) / M_PER_PX + cy) for p in ring]
    d.polygon([tuple(p) for p in px], outline=(220, 0, 0))
    cxm, cym = it["centroid"]
    sx = (-cxm) / M_PER_PX + cx
    sy = (-cym) / M_PER_PX + cy
    r = 17
    d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(255, 255, 255), outline=(200, 0, 0), width=2)
    txt = str(it["index"])
    w = (font.getlength(txt) if font else len(txt) * 8)
    d.text((sx - w / 2, sy - 14), txt, fill=(0, 0, 0), font=font)

dbg.save(os.path.join(OUT_DIR, "numbered.png"))

for name, box in {
    "q_nw": (0, 0, W // 2, H // 2),
    "q_ne": (W // 2, 0, W, H // 2),
    "q_sw": (0, H // 2, W // 2, H),
    "q_se": (W // 2, H // 2, W, H),
}.items():
    dbg.crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2), Image.LANCZOS) \
       .save(os.path.join(OUT_DIR, name + ".png"))

print("编号图 →", os.path.join(OUT_DIR, "numbered.png"))
print("JSON →", JSON_OUT)
