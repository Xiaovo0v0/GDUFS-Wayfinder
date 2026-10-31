# -*- coding: utf-8 -*-
"""从北校区平面图 b.jpg 提取操场（红色跑道 + 绿色场地）的几何。"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "artifacts", "north", "src", "b.jpg")

S = 0.4178
X0, Z0 = 628.4, 503.7
K = 2311.0 / 8787.0
OX = 358.0


def to_world(qx, qy):
    px = qx * K - OX
    py = qy * K
    return (X0 - (px + 0.5) * S, Z0 - (py + 0.5) * S)


def main():
    im = Image.open(SRC).convert("RGB")
    im = im.resize((im.size[0] // 3, im.size[1] // 3), Image.LANCZOS)
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    # 跑道红
    red = (r > 150) & (r > g + 60) & (r > b + 60) & (g < 110)
    red = ndi.binary_closing(red, np.ones((9, 9)))
    red = ndi.binary_opening(red, np.ones((5, 5)))
    lab, n = ndi.label(red)
    if n == 0:
        print("no red")
        return
    sizes = ndi.sum(red, lab, range(1, n + 1))
    i = int(np.argmax(sizes)) + 1
    sel = lab == i
    ys, xs = np.nonzero(sel)
    print("red px", len(xs), "bbox px", xs.min(), xs.max(), ys.min(), ys.max())
    # 半分辨率（实际是 1/3）
    q = 3.0
    cxp, cyp = (xs.min() + xs.max()) / 2.0 * q, (ys.min() + ys.max()) / 2.0 * q
    w = (xs.max() - xs.min()) * q
    h = (ys.max() - ys.min()) * q
    cx, cz = to_world(cxp, cyp)
    print("center world %.1f %.1f  w %.0f m  h %.0f m" % (cx, cz, w * K * S, h * K * S))
    # 绿色内场
    inner = (g > 120) & (g > r + 40) & (g > b + 60)
    sub = inner[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    lab2, n2 = ndi.label(ndi.binary_closing(sub, np.ones((7, 7))))
    if n2:
        s2 = ndi.sum(sub, lab2, range(1, n2 + 1))
        j = int(np.argmax(s2)) + 1
        ys2, xs2 = np.nonzero(lab2 == j)
        print("pitch bbox in track: x %d..%d y %d..%d  (%.0f x %.0f m)"
              % (xs2.min(), xs2.max(), ys2.min(), ys2.max(),
                 (xs2.max() - xs2.min()) * q * K * S, (ys2.max() - ys2.min()) * q * K * S))
        pcx, pcz = to_world((xs2.min() + xs2.max()) / 2.0 * q + xs.min() * q,
                            (ys2.min() + ys2.max()) / 2.0 * q + ys.min() * q)
        print("pitch center world %.1f %.1f" % (pcx, pcz))


if __name__ == "__main__":
    main()
