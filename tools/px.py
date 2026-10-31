# -*- coding: utf-8 -*-
"""从截图里采样指定像素，帮助判断某个色带到底是哪个 mesh 画的。"""
import sys
from PIL import Image

img = Image.open(sys.argv[1]).convert("RGB")
pts = [(int(a), int(b)) for a, b in (p.split(",") for p in sys.argv[2:])]
for x, y in pts:
    print((x, y), "#%02x%02x%02x" % img.getpixel((x, y)))
