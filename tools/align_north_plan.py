# -*- coding: utf-8 -*-
"""求 b.jpg（北校区平面图）与 gdufs-3d/assets/north-roads.png 的几何关系。

已知资产像素与世界坐标的关系：
    x = X0 - (px + 0.5) * S,  z = Z0 - (py + 0.5) * S,  S = 0.4178
只要找到 b.jpg -> 资产像素的缩放/翻转/平移，就能把图上的绿地边界搬到世界坐标。
"""
import os

import numpy as np
from PIL import Image
from scipy.signal import fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "artifacts", "north", "src", "b.jpg")
ASSET = os.path.join(ROOT, "gdufs-3d", "assets", "north-roads.png")


def road_mask_bgrgb(im):
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    # 平面图道路是深灰 (~108,112,116)
    return np.abs(a - np.array([108, 112, 116])).max(axis=2) <= 26


def main():
    im = Image.open(SRC)
    W0, H0 = im.size
    print("b.jpg", W0, H0)
    am = np.asarray(Image.open(ASSET).convert("RGBA"))[:, :, 3] > 100
    A = am.astype(np.float32)
    A -= A.mean()
    best = None
    for flip in (False, True):
        src = im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
        for k in np.arange(0.258, 0.3001, 0.004):
            w, h = int(round(W0 * k)), int(round(H0 * k))
            if w < 2400 or h < 2311:
                continue
            small = src.resize((w, h), Image.BILINEAR)
            B = road_mask_bgrgb(small).astype(np.float32)
            if B.sum() < 1000:
                continue
            B -= B.mean()
            # 互相关：找 A 在 B 中的最佳位置
            corr = fftconvolve(B, A[::-1, ::-1], mode="valid")
            idx = np.unravel_index(np.argmax(corr), corr.shape)
            oy, ox = idx
            sub = road_mask_bgrgb(small)[oy:oy + 2311, ox:ox + 2400]
            inter = np.logical_and(sub, am).sum()
            union = np.logical_or(sub, am).sum()
            iou = inter / max(union, 1)
            if best is None or iou > best[0]:
                best = (iou, flip, k, ox, oy, sub.sum())
            print("flip=%s k=%.3f -> off(%d,%d) IoU %.3f" % (flip, k, ox, oy, iou))
    print("BEST", best)


if __name__ == "__main__":
    main()
