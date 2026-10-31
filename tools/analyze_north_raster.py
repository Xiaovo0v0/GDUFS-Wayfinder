# -*- coding: utf-8 -*-
"""北校区栅格资源分析：道路/水系掩膜 -> 宽度分布、连通性、中心线骨架预览。

官方平面图里道路被画成一层灰度掩膜（north-roads.png），水系一层（north-river.png）。
这里先量出道路宽度分布，确定「车行道 / 人行道」的阈值，再决定矢量化策略。
"""
import io
import json

import numpy as np
from PIL import Image
from scipy import ndimage

ROADS = "gdufs-3d/assets/north-roads.png"
RIVER = "gdufs-3d/assets/north-river.png"
DATA = "gdufs-3d/north-data.js"


def load_mask(path):
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    return (a[:, :, 3] > 128), im.size


def main():
    mask, size = load_mask(ROADS)
    print("roads png", size, "px  0.4178 m/px")
    print("mask px", int(mask.sum()), "=%.0f m2" % (mask.sum() * 0.4178 ** 2))

    # 连通块
    lbl, n = ndimage.label(mask, structure=np.ones((3, 3)))
    sizes = ndimage.sum(mask, lbl, range(1, n + 1))
    print("components", n, "top sizes", sorted(sizes)[-5:])

    dist = ndimage.distance_transform_edt(mask) * 0.4178
    print("dist max %.2f m" % dist.max())

    # 只看骨架上的宽度：先做一遍腐蚀得到脊线附近的点
    ridge = dist >= (ndimage.maximum_filter(dist, size=5) - 1e-9)
    w = (2 * dist[ridge & mask])
    print("ridge width percentiles",
          {p: round(float(np.percentile(w, p)), 2) for p in (1, 5, 10, 25, 50, 75, 90, 95, 99)})
    hist, edges = np.histogram(w, bins=[0, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 60])
    for i in range(len(hist)):
        print("  %.0f-%.0f m: %d" % (edges[i], edges[i + 1], hist[i]))

    rmask, rsize = load_mask(RIVER)
    print("river px", int(rmask.sum()), "=%.0f m2" % (rmask.sum() * 0.4178 ** 2))
    rl, rn = ndimage.label(rmask, structure=np.ones((3, 3)))
    rs = ndimage.sum(rmask, rl, range(1, rn + 1))
    print("river components", rn, sorted(rs)[-5:])

    s = io.open(DATA, encoding="utf-8").read()
    d = json.loads(s[s.index("{"):s.rindex("}") + 1])
    print("extent", d["layers"]["roads"]["extent"])


if __name__ == "__main__":
    main()
