# -*- coding: utf-8 -*-
"""把北校区建筑轮廓转成 Blender 脚本要的格式，并生成北校区 GLB。

北校区数据：data/official/north_buildings.json（官方平面图矢量化，42 栋）
输出：artifacts/blender/north_buildings.json → gdufs-3d/assets/north_buildings.glb

用法：python tools/prep_north_glb.py
"""
import json
import math
import os

REPO = r"C:\Users\86134\Desktop\gdufs"
SRC = os.path.join(REPO, "data", "official", "north_buildings.json")
DST = os.path.join(REPO, "artifacts", "blender", "north_buildings.json")

# 类型 → 立面风格（沿用南校区那套贴图）
STYLE = {
    "teaching": {"kind": "ribbon", "wall": [188, 184, 170], "accent": [120, 96, 78], "glass": [58, 74, 82]},
    "admin":    {"kind": "panel",  "wall": [196, 192, 180], "accent": [112, 92, 74], "glass": [54, 70, 80]},
    "library":  {"kind": "large",  "wall": [186, 178, 162], "accent": [140, 104, 70], "glass": [50, 66, 78]},
    "dorm":     {"kind": "punch",  "wall": [206, 198, 182], "accent": [150, 120, 96], "glass": [62, 78, 86]},
    "canteen":  {"kind": "punch",  "wall": [198, 176, 150], "accent": [156, 100, 66], "glass": [60, 74, 82]},
    "culture":  {"kind": "ribbon", "wall": [190, 180, 164], "accent": [150, 92, 62], "glass": [56, 72, 82]},
    "sports":   {"kind": "large",  "wall": [176, 182, 186], "accent": [110, 118, 126], "glass": [58, 74, 84]},
    "service":  {"kind": "panel",  "wall": [196, 192, 180], "accent": [120, 100, 80], "glass": [56, 72, 82]},
    "clinic":   {"kind": "punch",  "wall": [208, 206, 198], "accent": [140, 116, 96], "glass": [58, 76, 84]},
    "hotel":    {"kind": "curtain","wall": [182, 178, 168], "accent": [116, 96, 78], "glass": [52, 68, 80]},
    "misc":     {"kind": "panel",  "wall": [196, 192, 182], "accent": [124, 104, 84], "glass": [58, 74, 82]},
}


def ring_area(ring):
    s = 0.0
    n = len(ring)
    for i in range(n):
        x1, z1 = ring[i]
        x2, z2 = ring[(i + 1) % n]
        s += x1 * z2 - x2 * z1
    return abs(s) * 0.5


def drop_collinear(ring, eps=0.35):
    """去掉近共线的点，避免 Blender 里出现退化四边形。"""
    if len(ring) < 4:
        return ring
    out = []
    n = len(ring)
    for i in range(n):
        a = ring[i - 1]
        b = ring[i]
        c = ring[(i + 1) % n]
        cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        base = math.hypot(c[0] - a[0], c[1] - a[1])
        if base > 1e-6 and abs(cross) / base < eps:
            continue
        out.append(b)
    return out if len(out) >= 3 else ring


def main():
    data = json.load(open(SRC, encoding="utf-8"))
    out = []
    skipped = 0
    for b in data["buildings"]:
        ring = [tuple(p) for p in b["ring"]]
        ring = drop_collinear(ring)
        if len(ring) < 3 or ring_area(ring) < 60:
            skipped += 1
            continue
        # 保证逆时针（Blender 那边按逆时针朝外）
        if ring_area(ring) <= 0:
            ring = ring[::-1]
        t = b.get("type") or "misc"
        out.append({
            "id": "N%03d" % b["index"],
            "name": b.get("name") or "",
            "type": t,
            "levels": b.get("levels") or max(1, round((b.get("height") or 10) / 3.6)),
            "height": b.get("height") or 12,
            "area": b.get("area") or ring_area(ring),
            "rings": [[list(p) for p in ring]],
            "style": STYLE.get(t, STYLE["misc"]),
        })

    os.makedirs(os.path.dirname(DST), exist_ok=True)
    json.dump({"buildings": out}, open(DST, "w", encoding="utf-8"), ensure_ascii=False)
    print("北校区：写入 %d 栋（跳过 %d 栋过小/退化）→ %s" % (len(out), skipped, DST))
    print("高度范围：%.1f – %.1f m" % (min(b["height"] for b in out), max(b["height"] for b in out)))
    print("面积合计：%.0f m²" % sum(b["area"] for b in out))


if __name__ == "__main__":
    main()
