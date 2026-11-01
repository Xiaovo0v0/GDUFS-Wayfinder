# -*- coding: utf-8 -*-
"""校验矢量化结果与原始栅格是否重合：把中心线顶点映回像素，统计落在掩膜上的比例。"""
import io
import json

import numpy as np
from PIL import Image

S = 0.4178
X0, Z0 = 628.4, 503.7
PNG = "gdufs-3d/assets/north-roads.png"
VEC = "artifacts/north/roads_vec.json"

mask = np.array(Image.open(PNG).convert("RGBA"))[:, :, 3] > 128
H, W = mask.shape
roads = json.load(io.open(VEC, encoding="utf-8"))

tot = on = 0
bad = []
for r in roads:
    pts = r["lines"][0]
    c = 0
    for x, z in pts:
        px = int(round((X0 - x) / S - 0.5))
        py = int(round((Z0 - z) / S - 0.5))
        if 0 <= px < W and 0 <= py < H and mask[py, px]:
            c += 1
    tot += len(pts)
    on += c
    if c < len(pts) * 0.8:
        bad.append((r["highway"], r["len"], len(pts), c, pts[0]))
print("vertices on mask: %d / %d = %.1f%%" % (on, tot, 100.0 * on / tot))
print("suspect roads", len(bad))
for b in bad[:12]:
    print("  ", b)
