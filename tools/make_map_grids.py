# -*- coding: utf-8 -*-
"""给官方平面图生成带像素网格的局部放大图，便于人工读取标注位置。"""
import os
from PIL import Image, ImageDraw

SRC = r"C:\Users\86134\Desktop\gdufs\data\official\map\gdufs_dxcxq_official_map.jpg"
OUT = r"C:\Users\86134\Desktop\gdufs\artifacts\geo"
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert("RGB")
W, H = img.size
print("source size:", W, H)

# 区域按 0-1 相对坐标给出，便于在总览图上对照
REGIONS = {
    "gates_ne":   (0.46, 0.16, 0.72, 0.42),   # 正门 / 实验楼北
    "gates_east": (0.60, 0.30, 0.85, 0.60),   # 行政出入口 / 实验楼A
    "gates_mid":  (0.35, 0.42, 0.62, 0.66),   # 1号门 / 隧道 / 文采园
    "gates_south":(0.28, 0.60, 0.62, 0.88),   # 2/3/4号门 / 南苑
    "labs":       (0.50, 0.20, 0.78, 0.48),   # 实验楼带
}

for name, (x0, y0, x1, y1) in REGIONS.items():
    box = (int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H))
    crop = img.crop(box)
    # 放大到约 1400px 宽
    scale = 1400 / crop.width
    crop = crop.resize((int(crop.width * scale), int(crop.height * scale)), Image.LANCZOS)
    d = ImageDraw.Draw(crop)
    step = 100
    for gx in range(0, crop.width, step):
        d.line([(gx, 0), (gx, crop.height)], fill=(255, 0, 0), width=1)
        d.text((gx + 2, 2), str(int(box[0] + gx / scale)), fill=(255, 0, 0))
    for gy in range(0, crop.height, step):
        d.line([(0, gy), (crop.width, gy)], fill=(0, 120, 255), width=1)
        d.text((2, gy + 1), str(int(box[1] + gy / scale)), fill=(0, 90, 255))
    path = os.path.join(OUT, f"grid_{name}.png")
    crop.save(path)
    print("wrote", path, crop.size, "box", box)
