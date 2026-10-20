# -*- coding: utf-8 -*-
"""从官方平面图里提取白色建筑块，输出面积前 N 的连通域质心（原图像素坐标）。"""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = r"C:\Users\86134\Desktop\gdufs\data\official\map\gdufs_dxcxq_official_map.jpg"
OUT = r"C:\Users\86134\Desktop\gdufs\artifacts\geo\components.json"

img = Image.open(SRC).convert("RGB")
W, H = img.size
SCALE = 4  # 降采样，加快连通域
small = img.resize((W // SCALE, H // SCALE), Image.BILINEAR)
a = np.asarray(small).astype(np.int16)

# 白色建筑：三通道都高且接近
r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
white = (r > 228) & (g > 228) & (b > 228)
# 去掉细线（道路虚线是白色细线）
white = ndimage.binary_opening(white, structure=np.ones((3, 3)))

lab, n = ndimage.label(white)
print("components:", n)
sizes = ndimage.sum(white, lab, range(1, n + 1))
order = np.argsort(sizes)[::-1][:40]

rows = []
for idx in order:
    cid = idx + 1
    area = float(sizes[idx]) * SCALE * SCALE
    ys, xs = np.where(lab == cid)
    cx = float(xs.mean()) * SCALE
    cy = float(ys.mean()) * SCALE
    h = (ys.max() - ys.min()) * SCALE
    w = (xs.max() - xs.min()) * SCALE
    rows.append({"area_m2_px": round(area), "cx": round(cx), "cy": round(cy), "w": round(w), "h": round(h)})

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=1)

for r_ in rows[:24]:
    print(r_)
