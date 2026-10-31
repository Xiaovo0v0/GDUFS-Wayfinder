# -*- coding: utf-8 -*-
"""北校区官方平面图栅格道路 -> 矢量中心线（skimage + skan 版）。

流程：
  mask --skeletonize--> 1px 骨架 --skan--> 分支折线（像素坐标）
       --距离变换--> 每点路宽 --按宽度分类--> highway 类型
       --shapely--> 抽稀、合并、输出 roads 列表

输出：
  artifacts/north/roads_vec.json      中间结果（含宽度）
  artifacts/north/roads_overlay.png   叠加检查图
"""
import io
import json
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from shapely.geometry import LineString
from shapely.ops import unary_union
from skimage.morphology import skeletonize
from skan import Skeleton

S = 0.4178                 # m / px
PNG = "gdufs-3d/assets/north-roads.png"
OUT_DIR = "artifacts/north"
MIN_LEN = 6.0              # 米
SIMPLIFY = 0.6             # 米
X0, Z0 = 628.4, 503.7      # 栅格左上角对应世界坐标（见 north-data.js layers.roads.extent）


def to_world(px, py):
    return (X0 - (px + 0.5) * S, Z0 - (py + 0.5) * S)


def classify(width):
    """按路宽粗分道路等级（米）。官方平面图的线宽约定：
    主干道 ~13-15 m，次干道 ~10-11 m，支路/服务道路 ~8-9 m，人行道 ~4-6 m。"""
    if width >= 12.5:
        return "secondary"
    if width >= 9.5:
        return "tertiary"
    if width >= 7.0:
        return "service"
    return "footway"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    mask = np.array(Image.open(PNG).convert("RGBA"))[:, :, 3] > 128
    dist = ndimage.distance_transform_edt(mask)
    skel = skeletonize(mask)
    print("mask px", int(mask.sum()), "skel px", int(skel.sum()))

    sk = Skeleton(skel, source_image=mask)
    paths = [sk.path_coordinates(i) for i in range(sk.n_paths)]
    print("paths", len(paths))

    pieces = []
    for path in paths:
        if len(path) < 3:
            continue
        xy = [to_world(x, y) for (y, x) in path]
        ls = LineString(xy)
        L = ls.length
        if L < MIN_LEN:
            continue
        widths = [2 * dist[y, x] * S for (y, x) in path]
        pieces.append((ls, L, float(np.median(widths)), float(np.mean(widths))))
    print("kept pieces", len(pieces), "total %.0f m" % sum(p[1] for p in pieces))

    # 合并同一条路被分支点切断的碎段：端点相接且宽度接近就拼起来
    merged = merge_pieces(pieces)
    print("merged", len(merged), "total %.0f m" % sum(p[1] for p in merged))

    out = []
    for ls, L, med, mean in merged:
        ls2 = ls.simplify(SIMPLIFY, preserve_topology=False)
        if ls2.is_empty or ls2.length < MIN_LEN:
            continue
        out.append({
            "name": "",
            "highway": classify(med),
            "width": round(med, 1),
            "len": round(ls2.length, 1),
            "lines": [[[round(c[0], 2), round(c[1], 2)] for c in ls2.coords]],
        })
    out.sort(key=lambda r: -r["len"])
    print("roads", len(out), "total %.0f m" % sum(r["len"] for r in out))
    from collections import Counter
    print("by type", Counter(r["highway"] for r in out))

    json.dump(out, io.open(os.path.join(OUT_DIR, "roads_vec.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    base = Image.open(PNG).convert("RGBA")
    bg = Image.new("RGBA", base.size, (26, 30, 26, 255))
    bg.alpha_composite(base)
    dr = ImageDraw.Draw(bg)
    colmap = {"secondary": (255, 90, 90, 255), "tertiary": (255, 200, 70, 255),
              "service": (90, 200, 255, 255), "footway": (140, 255, 140, 255)}
    for r in out:
        pts = [((X0 - c[0]) / S - 0.5, (Z0 - c[1]) / S - 0.5) for c in r["lines"][0]]
        dr.line(pts, fill=colmap[r["highway"]], width=2)
    bg.save(os.path.join(OUT_DIR, "roads_overlay.png"))
    print("wrote overlay")


def merge_pieces(pieces, tol=1.2, wtol=2.5):
    """把端点相接、宽度相近的碎段拼成整条路。"""
    items = [{"ls": p[0], "w": p[2]} for p in pieces]
    changed = True
    while changed:
        changed = False
        for i in range(len(items)):
            if items[i] is None:
                continue
            a = items[i]
            for j in range(i + 1, len(items)):
                if items[j] is None:
                    continue
                b = items[j]
                if abs(a["w"] - b["w"]) > wtol:
                    continue
                m = try_join(a["ls"], b["ls"], tol)
                if m is not None:
                    a["ls"] = m
                    a["w"] = (a["w"] + b["w"]) / 2
                    items[j] = None
                    changed = True
        items = [x for x in items if x is not None]
    return [(it["ls"], it["ls"].length, it["w"], it["w"]) for it in items]


def try_join(A, B, tol):
    ac = list(A.coords)
    bc = list(B.coords)
    pairs = [
        (ac[-1], bc[0], ac, bc, False),
        (ac[-1], bc[-1], ac, list(reversed(bc)), False),
        (ac[0], bc[0], list(reversed(ac)), bc, True),
        (ac[0], bc[-1], list(reversed(ac)), list(reversed(bc)), True),
    ]
    for p1, p2, a1, b1, rev in pairs:
        if (p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 <= tol ** 2:
            joined = a1 + b1[1:]
            return LineString(joined)
    return None


if __name__ == "__main__":
    main()
