# -*- coding: utf-8 -*-
"""生成 5 种立面贴图（1 tile = 3.6m 开间 x 3.6m 层高），供 Blender 材质与 GLB 使用。"""
import os
from PIL import Image, ImageDraw

OUT = r"C:\Users\86134\Desktop\gdufs\artifacts\blender\tex"
os.makedirs(OUT, exist_ok=True)
S = 256
SC = S / 128.0  # 设计稿按 128px 画，放大到 256


def px(v):
    return int(round(v * SC))


def mk(kind, wall, accent, glass, name):
    img = Image.new("RGB", (S, S), wall)
    d = ImageDraw.Draw(img)

    # 瓷砖/石材分隔缝
    for y in range(0, S, px(16)):
        d.line([(0, y), (S, y)], fill=tuple(max(0, c - 12) for c in wall), width=1)

    if kind == "ribbon":
        d.rectangle([px(7), px(36), px(121), px(88)], fill=glass)
        d.rectangle([px(7), px(36), px(121), px(48)], fill=tuple(min(255, c + 26) for c in glass))
        d.rectangle([0, px(30), px(7), px(94)], fill=accent)
        d.rectangle([px(121), px(30), S, px(94)], fill=accent)
        x = px(7)
        while x < px(112):
            d.rectangle([x + px(26), px(36), x + px(29), px(88)], fill=accent)
            x += px(30)
        d.rectangle([px(4), px(88), px(124), px(92)], fill=tuple(max(0, c - 24) for c in wall))
    elif kind == "punch":
        for bx in (px(14), px(76)):
            d.rectangle([bx, px(30), bx + px(34), px(84)], fill=accent)
            d.rectangle([bx + px(3), px(33), bx + px(31), px(81)], fill=glass)
            d.rectangle([bx + px(3), px(33), bx + px(31), px(42)],
                        fill=tuple(min(255, c + 30) for c in glass))
            d.rectangle([bx - px(2), px(86), bx + px(36), px(90)],
                        fill=tuple(max(0, c - 26) for c in wall))
    elif kind == "curtain":
        d.rectangle([0, 0, S, S], fill=glass)
        d.rectangle([0, px(8), S, px(26)], fill=tuple(min(255, c + 22) for c in glass))
        d.rectangle([0, 0, px(9), S], fill=accent)
        d.rectangle([px(119), 0, S, S], fill=accent)
        d.rectangle([0, px(116), S, S], fill=accent)
        x = px(26)
        while x < px(118):
            d.rectangle([x, 0, x + px(2), S], fill=tuple(max(0, c - 30) for c in glass))
            x += px(34)
    elif kind == "large":
        d.rectangle([0, 0, S, px(20)], fill=accent)
        d.rectangle([px(8), px(26), px(120), px(104)], fill=glass)
        d.rectangle([px(8), px(26), px(120), px(42)], fill=tuple(min(255, c + 24) for c in glass))
        d.rectangle([0, 0, px(8), S], fill=accent)
        d.rectangle([px(120), 0, S, S], fill=accent)
        x = px(8)
        while x < px(112):
            d.rectangle([x + px(36), px(26), x + px(40), px(104)], fill=accent)
            x += px(40)
        d.rectangle([0, px(104), S, px(110)], fill=tuple(max(0, c - 28) for c in wall))
    else:  # panel
        d.rectangle([0, 0, S, S], fill=wall)
        for x in range(0, S, px(22)):
            d.line([(x, 0), (x, S)], fill=tuple(max(0, c - 10) for c in wall), width=1)
        d.rectangle([px(10), px(22), px(118), px(52)], fill=glass)
        d.rectangle([px(10), px(22), px(118), px(30)], fill=tuple(min(255, c + 28) for c in glass))
        d.rectangle([0, px(110), S, S], fill=accent)

    path = os.path.join(OUT, name + ".png")
    img.save(path)
    print("wrote", path)


mk("ribbon", (196, 187, 168), (156, 79, 57), (58, 74, 82), "ribbon")
mk("punch", (203, 189, 159), (185, 168, 136), (65, 78, 87), "punch")
mk("curtain", (133, 75, 57), (111, 59, 43), (47, 90, 88), "curtain")
mk("large", (164, 100, 76), (143, 79, 60), (60, 74, 80), "large")
mk("panel", (179, 191, 199), (132, 150, 163), (107, 132, 150), "panel")
print("done")
