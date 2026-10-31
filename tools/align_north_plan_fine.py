# -*- coding: utf-8 -*-
"""在 k≈0.266 附近细化 b.jpg 与 north-roads.png 的对齐参数。"""
import os

import numpy as np
from PIL import Image
from scipy.signal import fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "artifacts", "north", "src", "b.jpg")
ASSET = os.path.join(ROOT, "gdufs-3d", "assets", "north-roads.png")


def road_mask(im):
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    return np.abs(a - np.array([108, 112, 116])).max(axis=2) <= 26


def main():
    im = Image.open(SRC)
    W0, H0 = im.size
    am = np.asarray(Image.open(ASSET).convert("RGBA"))[:, :, 3] > 100
    A = am.astype(np.float32)
    A -= A.mean()
    best = None
    for k in np.arange(0.2480, 0.2631, 0.0010):
        w, h = int(round(W0 * k)), int(round(H0 * k))
        if w < 2400 or h < 2311:
            continue
        small = im.resize((w, h), Image.BILINEAR)
        m = road_mask(small)
        B = m.astype(np.float32)
        B -= B.mean()
        corr = fftconvolve(B, A[::-1, ::-1], mode="valid")
        oy, ox = np.unravel_index(np.argmax(corr), corr.shape)
        sub = m[oy:oy + 2311, ox:ox + 2400]
        inter = np.logical_and(sub, am).sum()
        union = np.logical_or(sub, am).sum()
        iou = inter / max(union, 1)
        print("k=%.4f off(%d,%d) IoU %.4f" % (k, ox, oy, iou))
        if best is None or iou > best[0]:
            best = (iou, k, ox, oy)
    print("BEST iou=%.4f k=%.4f ox=%d oy=%d" % best)


if __name__ == "__main__":
    main()
