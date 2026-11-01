# -*- coding: utf-8 -*-
"""把 north-data.js 的边界/道路/操场/建筑画到官方北校区平面图 b.jpg 上，检查对齐。"""
import io
import json
import math
import os
import re

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "artifacts", "north", "src", "b.jpg")
DATA = os.path.join(ROOT, "gdufs-3d", "north-data.js")
OUT = os.path.join(ROOT, "artifacts", "north", "src", "plan_overlay.png")

S = 0.4178
X0, Z0 = 628.4, 503.7
K = 2311.0 / 8787.0
OX = 358.0


def to_px(x, z):
    return (((X0 - x) / S - 0.5 + OX) / K, ((Z0 - z) / S - 0.5) / K)


def load():
    raw = io.open(DATA, encoding="utf-8").read()
    i = raw.index("{")
    j = raw.rindex("}")
    return json.loads(raw[i:j + 1])


def main():
    D = load()
    im = Image.open(SRC).convert("RGB")
    SC = 1300.0 / im.size[0]
    im = im.resize((1300, int(im.size[1] * SC)), Image.LANCZOS)
    dr = ImageDraw.Draw(im)

    def P(p):
        qx, qy = to_px(*p)
        return (qx * SC, qy * SC)

    for b in D["buildings"]:
        for ring in b["rings"]:
            dr.line([P(p) for p in ring], fill=(255, 0, 0), width=2)
    for r in D["roads"]:
        col = {"secondary": (220, 30, 30), "tertiary": (230, 140, 0),
               "service": (30, 90, 220), "footway": (0, 150, 60)}.get(r["highway"], (120, 0, 160))
        for ln in r["lines"]:
            dr.line([P(p) for p in ln], fill=col, width=2)
    for w in D.get("waterPolygons") or []:
        for ring in w["rings"]:
            dr.line([P(p) for p in ring], fill=(0, 120, 200), width=2)
    for f in D.get("landscape") or []:
        if f.get("type") == "sports_field":
            dr.line([P(p) for p in f["track"]], fill=(255, 0, 255), width=3)
            dr.line([P(p) for p in f["pitch"]], fill=(255, 255, 0), width=2)
    for ring in D["boundary"]:
        dr.line([P(p) for p in ring], fill=(0, 0, 0), width=3)
    for g in D["gates"]:
        px, py = P((g["x"], g["z"]))
        dr.ellipse([px - 7, py - 7, px + 7, py + 7], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
    im.save(OUT)
    print("saved", OUT)


if __name__ == "__main__":
    main()
