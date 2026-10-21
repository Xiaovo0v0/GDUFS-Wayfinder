"""北校区平面图分割探针：只为确认"白色建筑 + 绿色校园"能否分开。
输出三张调试图到 artifacts/north/，不改动任何数据。
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = r"data\official\_raw\campus_map_北校.jpg"
OUT = r"artifacts\north"
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert("RGB")
W0, H0 = im.size
print("原图", W0, H0)

# 去掉左侧标题栏（绿色侧边条），只保留地图主体
crop_x0 = int(W0 * 0.13)
im = im.crop((crop_x0, 0, W0, H0))

# 缩到宽度 2400，便于处理
TARGET_W = 2400
ratio = TARGET_W / im.width
im = im.resize((TARGET_W, int(im.height * ratio)), Image.LANCZOS)
W, H = im.size
print("处理尺寸", W, H)

a = np.asarray(im).astype(np.int16)
R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]

# 绿色校园区域
green = (G > R + 8) & (G > B + 8) & (G > 60)
green = ndimage.binary_closing(green, np.ones((5, 5)))
green = ndimage.binary_fill_holes(green)
green = ndimage.binary_opening(green, np.ones((7, 7)))

# 白色建筑
white = (R > 222) & (G > 222) & (B > 214)
white = white & green                      # 只取校园内的白
white = ndimage.binary_opening(white, np.ones((3, 3)))
white = ndimage.binary_closing(white, np.ones((3, 3)))

lab, n = ndimage.label(white)
sizes = ndimage.sum(white, lab, range(1, n + 1))
print("白色连通域", n)

# 以"跑道"标定比例：先看最大的红色连通域
red = (R > 150) & (R > G + 45) & (R > B + 45)
red = ndimage.binary_closing(red, np.ones((5, 5)))
rlab, rn = ndimage.label(red)
rsizes = ndimage.sum(red, rlab, range(1, rn + 1)) if rn else []
track_info = None
if rn:
    k = int(np.argmax(rsizes)) + 1
    ys, xs = np.where(rlab == k)
    tw, th = xs.max() - xs.min(), ys.max() - ys.min()
    track_info = (tw, th, float(rsizes[k - 1]))
    print("最大红色块 像素宽高", tw, th, "面积", rsizes[k - 1])

# 保存调试图
def save(mask, name, tint):
    out = np.zeros((H, W, 3), dtype=np.uint8)
    out[mask] = tint
    Image.fromarray(out).save(os.path.join(OUT, name))

save(green, "mask_green.png", (40, 160, 60))
save(white, "mask_white.png", (255, 255, 255))
save(red, "mask_red.png", (220, 40, 40))

# 叠加图：原图 + 半透明白标记
over = np.asarray(im).copy()
over[white] = (over[white] * 0.35 + np.array([255, 60, 60]) * 0.65).astype(np.uint8)
Image.fromarray(over).save(os.path.join(OUT, "overlay.png"))

print("调试图已写入", OUT)
