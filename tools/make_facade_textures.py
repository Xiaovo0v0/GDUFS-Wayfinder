# -*- coding: utf-8 -*-
"""生成立面贴图（1 tile = 3.6m 开间 × 3.6m 层高）。

相比第一版：分辨率 256 → 512，每种类型出 3 个配色（冷灰 / 暖砂 / 赭石），
让 51 栋楼不会长得一模一样；细节上补了窗台滴水线、窗框厚度、空调外机、
幕墙横挺、金属板肋条的明暗边。

用法：python tools/make_facade_textures.py
"""
import os
import random

from PIL import Image, ImageDraw

OUT = r"C:\Users\86134\Desktop\gdufs\artifacts\blender\tex"
os.makedirs(OUT, exist_ok=True)
S = 512
U = S / 128.0          # 设计稿按 128 单位画，放大到 512


def q(v):
    return int(round(v * U))


def shade(c, k):
    """k>0 提亮，k<0 压暗（0..1 比例）。"""
    if k >= 0:
        return tuple(min(255, int(c + (255 - c) * k)) for c in c0) if False else tuple(
            min(255, int(v + (255 - v) * k)) for v in c)
    return tuple(max(0, int(v * (1 + k))) for v in c)


def noise(img, amp=5, seed=7):
    """轻微噪点，去掉纯色的塑料感。"""
    rnd = random.Random(seed)
    px = img.load()
    w, h = img.size
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            d = rnd.randint(-amp, amp)
            r, g, b = px[x, y]
            px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))
    return img


def mk(kind, wall, accent, glass, name):
    img = Image.new("RGB", (S, S), wall)
    d = ImageDraw.Draw(img)

    # ---- 通用：石材/瓷砖分格（横向 1.8m 一道，竖向按开间）----
    for y in range(0, S, q(64)):
        d.line([(0, y), (S, y)], fill=shade(wall, -0.06), width=max(1, q(1)))
    for x in range(0, S, q(128)):
        d.line([(x, 0), (x, S)], fill=shade(wall, -0.04), width=max(1, q(1)))

    if kind == "punch":
        # 小窗：两个窗洞 + 窗框 + 窗台 + 空调外机
        for bi, bx in enumerate((q(12), q(74))):
            d.rectangle([bx, q(28), bx + q(38), q(86)], fill=accent)              # 窗框
            d.rectangle([bx + q(3), q(31), bx + q(35), q(83)], fill=glass)        # 玻璃
            d.rectangle([bx + q(3), q(31), bx + q(35), q(42)], fill=shade(glass, 0.30))  # 天光
            d.rectangle([bx + q(18), q(31), bx + q(21), q(83)], fill=shade(glass, -0.35))
            d.rectangle([bx + q(3), q(70), bx + q(35), q(73)], fill=shade(glass, -0.42))
            d.rectangle([bx - q(2), q(86), bx + q(40), q(91)], fill=shade(wall, 0.16))   # 窗台
            d.rectangle([bx - q(2), q(91), bx + q(40), q(93)], fill=shade(wall, -0.22))  # 滴水线
            if bi == 1:
                # 空调外机（宿舍楼很典型）
                d.rectangle([bx - q(6), q(96), bx + q(14), q(110)], fill=(206, 208, 206))
                d.rectangle([bx - q(6), q(96), bx + q(14), q(99)], fill=(176, 179, 178))
                for gx in range(3):
                    d.line([(bx - q(4) + gx * q(5), q(101)), (bx - q(4) + gx * q(5), q(108))],
                           fill=(150, 153, 152), width=max(1, q(1)))

    elif kind == "ribbon":
        # 横向长窗（教学楼）：一整条带窗 + 竖挺 + 上下墙裙
        d.rectangle([0, q(26), S, q(92)], fill=accent)
        d.rectangle([q(2), q(30), S - q(2), q(88)], fill=glass)
        d.rectangle([q(2), q(30), S - q(2), q(44)], fill=shade(glass, 0.28))
        x = q(2)
        while x < S - q(4):
            d.rectangle([x, q(30), x + q(3), q(88)], fill=accent)
            x += q(30)
        d.rectangle([0, q(88), S, q(93)], fill=shade(wall, 0.14))    # 窗台
        d.rectangle([0, q(93), S, q(95)], fill=shade(wall, -0.24))   # 滴水线
        d.rectangle([0, q(24), S, q(26)], fill=shade(wall, -0.20))

    elif kind == "curtain":
        # 玻璃幕墙（实验楼）：整面玻璃 + 竖向隐框 + 横向层间线
        d.rectangle([0, 0, S, S], fill=glass)
        d.rectangle([0, 0, S, q(14)], fill=shade(glass, 0.34))       # 顶部天光
        d.rectangle([0, q(96), S, S], fill=shade(glass, -0.14))
        x = q(4)
        while x < S:
            d.rectangle([x, 0, x + q(2), S], fill=accent)
            x += q(30)
        d.rectangle([0, q(108), S, q(112)], fill=accent)             # 横挺
        d.rectangle([0, q(108), S, q(110)], fill=shade(accent, 0.18))

    elif kind == "large":
        # 大玻璃（食堂/礼堂）：厚框 + 分格 + 底部墙裙
        d.rectangle([0, 0, S, q(12)], fill=accent)
        d.rectangle([q(6), q(18), S - q(6), q(104)], fill=accent)
        d.rectangle([q(11), q(23), S - q(11), q(99)], fill=glass)
        d.rectangle([q(11), q(23), S - q(11), q(40)], fill=shade(glass, 0.26))
        x = q(11)
        while x < S - q(11):
            d.rectangle([x, q(23), x + q(4), q(99)], fill=accent)
            x += q(38)
        d.rectangle([0, q(104), S, S], fill=shade(wall, -0.10))
        d.rectangle([0, q(104), S, q(107)], fill=shade(wall, 0.14))

    else:  # panel —— 金属板/涂料（体育馆、工业风）
        for x in range(0, S, q(16)):
            d.rectangle([x, 0, x + q(8), S], fill=shade(wall, 0.05))
            d.rectangle([x + q(8), 0, x + q(9), S], fill=shade(wall, -0.16))
        d.rectangle([q(8), q(30), S - q(8), q(84)], fill=glass)
        d.rectangle([q(8), q(30), S - q(8), q(46)], fill=shade(glass, 0.28))
        d.rectangle([0, q(84), S, q(88)], fill=shade(wall, 0.16))
        d.rectangle([0, q(118), S, S], fill=shade(wall, -0.18))

    # 不加逐像素噪点：纯色块 PNG 压缩率极高，GLB 才塞得进单文件
    path = os.path.join(OUT, name + ".png")
    img.save(path, optimize=True)
    return path


# 三套配色：冷灰 / 暖砂 / 赭石。每类立面各出一套，按楼栋 id 哈希取用
PALETTES = {
    "cold": {
        "wall": (176, 180, 184), "accent": (128, 134, 140), "glass": (62, 78, 88),
    },
    "sand": {
        "wall": (203, 189, 160), "accent": (172, 150, 116), "glass": (66, 80, 90),
    },
    "terra": {
        "wall": (183, 129, 102), "accent": (150, 96, 74), "glass": (58, 74, 82),
    },
}

KINDS = ("ribbon", "punch", "curtain", "large", "panel")

# 每类立面偏好的基色（保持原来的语义：教学楼暖、实验楼红砖、体育馆冷灰）
PREF = {
    "ribbon": "sand",
    "punch": "sand",
    "curtain": "terra",
    "large": "terra",
    "panel": "cold",
}

def mk_roof(name, base, joint, seed=3):
    """屋面：混凝土/碎石瓦，1 tile = 8m。远近都能读出灰度和分格。"""
    import random as _r
    rnd = _r.Random(seed)
    img = Image.new("RGB", (S, S), base)
    d = ImageDraw.Draw(img)
    # 大分格 2m
    for k in range(0, S + 1, q(32)):
        d.line([(k, 0), (k, S)], fill=joint, width=max(1, q(1)))
        d.line([(0, k), (S, k)], fill=joint, width=max(1, q(1)))
    # 碎石斑点（成块画，保证 PNG 压得动）
    for _ in range(420):
        x = rnd.randrange(0, S, 8); y = rnd.randrange(0, S, 8)
        sz = rnd.choice((4, 4, 8, 8, 12))
        dv = rnd.randint(-14, 14)
        c = tuple(max(0, min(255, v + dv)) for v in base)
        d.rectangle([x, y, x + sz, y + sz], fill=c)
    # 局部积水/污渍
    for _ in range(14):
        x = rnd.randrange(0, S); y = rnd.randrange(0, S)
        r = rnd.randint(q(8), q(22))
        d.ellipse([x - r, y - r, x + r, y + r], fill=tuple(max(0, v - 10) for v in base))
    img.save(os.path.join(OUT, name + ".png"), optimize=True)
    return name


# 屋面贴图
mk_roof("roof", (96, 99, 101), (84, 87, 89), 3)
mk_roof("roof_dark", (78, 81, 84), (66, 69, 72), 11)
print("屋面贴图 ok")


if __name__ == "__main__":
    made = 0
    for kind in KINDS:
        for pname, p in PALETTES.items():
            name = "%s_%s" % (kind, pname)
            mk(kind, p["wall"], p["accent"], p["glass"], name)
            made += 1
        # 兼容旧文件名：默认取偏好配色，主材质名保持不变
        p = PALETTES[PREF[kind]]
        mk(kind, p["wall"], p["accent"], p["glass"], kind)
        made += 1
    print("生成 %d 张立面贴图 → %s" % (made, OUT))
