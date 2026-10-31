# -*- coding: utf-8 -*-
"""检查北校水系矢量化结果与原始栅格是否吻合。"""
import io
import json

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

S = 0.4178
X0, Z0 = 628.4, 503.7
s = io.open("gdufs-3d/north-data.js", encoding="utf-8").read()
D = json.loads(s[s.index("{"):s.rindex("}") + 1])

riv = np.array(Image.open("gdufs-3d/assets/north-river.png").convert("RGBA"))
fig, ax = plt.subplots(figsize=(12, 12), dpi=100)
ext = [X0, X0 - riv.shape[1] * S, Z0 - riv.shape[0] * S, Z0]
ax.imshow(riv, extent=ext, origin="upper", interpolation="nearest")
for w in D["waterPolygons"]:
    for ring in w["rings"]:
        ax.plot([p[0] for p in ring], [p[1] for p in ring], color="#ff0044", lw=1.2)
ax.set_xlim(ext[1] - 20, ext[0] + 20)
ax.set_ylim(ext[2] - 20, ext[3] + 20)
ax.set_aspect("equal")
fig.tight_layout()
fig.savefig("artifacts/north/water_check.png")
print("polys", len(D["waterPolygons"]))
