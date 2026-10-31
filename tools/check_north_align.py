# -*- coding: utf-8 -*-
"""把官方平面图（栅格道路/河流）与矢量道路、建筑轮廓叠在一张图上，检查三者是否对齐。"""
import io
import json

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

S = 0.4178
X0, Z0 = 628.4, 503.7
DATA = "gdufs-3d/north-data.js"

s = io.open(DATA, encoding="utf-8").read()
D = json.loads(s[s.index("{"):s.rindex("}") + 1])

road = np.array(Image.open("gdufs-3d/assets/north-roads.png").convert("RGBA"))
river = np.array(Image.open("gdufs-3d/assets/north-river.png").convert("RGBA"))

fig, ax = plt.subplots(figsize=(12, 12), dpi=110)
ext = [X0, X0 - road.shape[1] * S, Z0 - road.shape[0] * S, Z0]  # left,right,bottom,top
ax.imshow(road, extent=ext, origin="upper", interpolation="nearest", zorder=1)
ax.imshow(river, extent=ext, origin="upper", interpolation="nearest", zorder=2)

for b in D["buildings"]:
    for ring in b["rings"]:
        ax.plot([p[0] for p in ring], [p[1] for p in ring], color="#101010", lw=0.8, zorder=3)
for ring in D["boundary"]:
    ax.plot([p[0] for p in ring], [p[1] for p in ring], color="#00c060", lw=1.5, zorder=4)
for r in json.load(io.open("artifacts/north/roads_vec.json", encoding="utf-8")):
    pts = r["lines"][0]
    ax.plot([p[0] for p in pts], [p[1] for p in pts], color="#ff2d2d", lw=0.8, zorder=5)
for g in D["gates"]:
    ax.plot(g["x"], g["z"], "o", color="#ffd400", ms=8, zorder=6)

ax.set_xlim(ext[1] - 20, ext[0] + 20)
ax.set_ylim(ext[2] - 20, ext[3] + 20)
ax.set_aspect("equal")
fig.tight_layout()
fig.savefig("artifacts/north/align_check.png")
print("ok")
