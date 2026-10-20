# -*- coding: utf-8 -*-
"""西南角（4号门）局部放大 + 像素网格"""
import os
from PIL import Image, ImageDraw

SRC = r"C:\Users\86134\Desktop\gdufs\data\official\map\gdufs_dxcxq_official_map.jpg"
OUT = r"C:\Users\86134\Desktop\gdufs\artifacts\geo"
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert("RGB")
W, H = img.size

# 西南角：相对坐标
x0, y0, x1, y1 = 0.22, 0.74, 0.50, 0.95
box = (int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H))
crop = img.crop(box)
scale = 1500 / crop.width
crop = crop.resize((int(crop.width * scale), int(crop.height * scale)), Image.LANCZOS)
d = ImageDraw.Draw(crop)
for gx in range(0, crop.width, 100):
    d.line([(gx, 0), (gx, crop.height)], fill=(255, 0, 0), width=1)
    d.text((gx + 2, 2), str(int(box[0] + gx / scale)), fill=(255, 0, 0))
for gy in range(0, crop.height, 100):
    d.line([(0, gy), (crop.width, gy)], fill=(0, 90, 255), width=1)
    d.text((2, gy + 1), str(int(box[1] + gy / scale)), fill=(0, 90, 255))
path = os.path.join(OUT, "grid_gate4_sw.png")
crop.save(path)
print("wrote", path, crop.size, "box", box)
