"""北校区：道路 / 相思河 / 校门 —— 从同一张官方平面图提取。

输出：
  gdufs-3d/assets/north-roads.png   透明底的道路图层（灰）
  gdufs-3d/assets/north-river.png   透明底的相思河图层（青）
  data/official/north_roads.json    路网网格图（20 m 格）+ 校门坐标 + 图层对齐参数
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = r"data\official\_raw\campus_map_北校.jpg"
JSON_OUT = r"data\official\north_roads.json"
ASSETS = r"gdufs-3d\assets"

M_PER_PX = 0.4178          # 与 extract_north_footprints.py 同一标定
CELL_M = 20.0              # 路网网格边长

im = Image.open(SRC).convert("RGB")
W0, H0 = im.size
im = im.crop((int(W0 * 0.13), 0, W0, H0))
TARGET_W = 2400
im = im.resize((TARGET_W, int(im.height * TARGET_W / im.width)), Image.LANCZOS)
W, H = im.size
a = np.asarray(im).astype(np.int16)
R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]

# 校园绿色范围（用于排除图外同色元素）
green = (G > R + 8) & (G > B + 8) & (G > 60)
green = ndimage.binary_fill_holes(ndimage.binary_closing(green, np.ones((5, 5))))

# ---- 道路：中性灰 ----
# 实测道路色 ≈ (112,112,96)，比纯灰偏黄一点
roads = (abs(R - 112) < 30) & (abs(G - 112) < 30) & (abs(B - 96) < 34) & (abs(R - G) < 14)
roads = ndimage.binary_opening(roads, np.ones((3, 3)))
roads = ndimage.binary_closing(roads, np.ones((7, 7)))

# ---- 相思河：深栗色 ----
# 实测相思河色 ≈ (112,32,32)
river = (R > 88) & (R < 150) & (G < 80) & (B < 80) & (R - G > 35)
river = ndimage.binary_opening(river, np.ones((3, 3)))
river = ndimage.binary_closing(river, np.ones((7, 7)))

# ---- 校门：橙色小块 ----
orange = (R > 200) & (G > 110) & (G < 200) & (B < 100)
orange = ndimage.binary_opening(orange, np.ones((5, 5)))

lab, n = ndimage.label(orange)
gates = []
for i in range(1, n + 1):
    comp = lab == i
    if comp.sum() < 60:
        continue
    ys, xs = np.where(comp)
    gates.append((float(xs.mean()), float(ys.mean())))
print("橙色块（候选校门）", len(gates))

# ---- 与建筑脚本一致的质心，保证两套坐标同源 ----
with open(r"data\official\north_buildings.json", encoding="utf-8") as f:
    bj = json.load(f)
# 建筑脚本的原点来自绿色区域质心；这里重新算一次同样的量
bys, bxs = np.where(green)
cx, cy = bxs.mean(), bys.mean()
print("质心 px=(%.1f, %.1f)  W=%d H=%d" % (cx, cy, W, H))


def px2m(x, y):
    return round((-(x - cx)) * M_PER_PX, 1), round((-(y - cy)) * M_PER_PX, 1)


# ---- 输出两张透明图层 ----
os.makedirs(ASSETS, exist_ok=True)


def dump(mask, color, name):
    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[mask] = (*color, 255)
    Image.fromarray(rgba).save(os.path.join(ASSETS, name))
    print(name, "px 覆盖率 %.1f%%" % (100.0 * mask.sum() / mask.size))


dump(roads, (108, 112, 116), "north-roads.png")
dump(river, (74, 118, 136), "north-river.png")

# ---- 路网网格图 ----
cell_px = CELL_M / M_PER_PX
nx = int(W / cell_px) + 1
ny = int(H / cell_px) + 1
nodes = []
index = {}
gx0 = int(cx % 1)
for gy in range(ny):
    for gx in range(nx):
        px0, px1 = int(gx * cell_px), int((gx + 1) * cell_px)
        py0, py1 = int(gy * cell_px), int((gy + 1) * cell_px)
        if px1 >= W or py1 >= H or px1 <= px0 or py1 <= py0:
            continue
        cover = roads[py0:py1, px0:px1].mean()
        if cover < 0.32:
            continue
        mx, my = px2m((px0 + px1) / 2.0, (py0 + py1) / 2.0)
        index[(gx, gy)] = len(nodes)
        nodes.append([mx, my])

edges = []
for (gx, gy), i in index.items():
    for dx, dy, ln in ((1, 0, CELL_M), (0, 1, CELL_M),
                       (1, 1, CELL_M * 1.4142), (1, -1, CELL_M * 1.4142)):
        j = index.get((gx + dx, gy + dy))
        if j is not None:
            edges.append({"a": i, "b": j, "len": round(ln, 1)})

print("路网节点 %d，边 %d" % (len(nodes), len(edges)))

gate_m = [list(px2m(x, y)) for x, y in gates]

payload = {
    "meta": {
        "scale_m_per_px": M_PER_PX,
        "image_size": [W, H],
        "origin_px": [round(cx, 2), round(cy, 2)],
        "layer_extent_m": {
            "x": [round(cx * M_PER_PX, 1), round(-(W - cx) * M_PER_PX, 1)],
            "z": [round(cy * M_PER_PX, 1), round(-(H - cy) * M_PER_PX, 1)],
        },
        "cell_m": CELL_M,
        "note": "道路/水系图层由官方平面图栅格化而来；路网为 20 m 网格近似",
    },
    "graph": {"nodes": nodes, "edges": edges},
    "gates_px": [[round(x, 1), round(y, 1)] for x, y in gates],
    "gates_m": gate_m,
}

with open(JSON_OUT, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
print("JSON →", JSON_OUT)
print("图层范围(m)：", payload["meta"]["layer_extent_m"])
print("校门(m)：", gate_m)
