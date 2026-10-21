# -*- coding: utf-8 -*-
"""检查 GLB 里的异常三角形（退化 / 顶点越界），定位漫游时的白色锯齿伪影。

用法：python tools/inspect_glb.py
"""
import json
import math
import struct

PATH = r"C:\Users\86134\Desktop\gdufs\gdufs-3d\assets\gdufs_buildings.glb"

data = open(PATH, "rb").read()
magic, ver, total = struct.unpack_from("<III", data, 0)
assert magic == 0x46546C67, "not a glb"
off = 12
chunks = {}
while off < total:
    clen, ctype = struct.unpack_from("<II", data, off)
    body = data[off + 8: off + 8 + clen]
    chunks[ctype] = body
    off += 8 + clen
gltf = json.loads(chunks[0x4E4F534A].decode("utf-8"))
BIN = chunks.get(0x004E4942, b"")

COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_accessor(i):
    acc = gltf["accessors"][i]
    bv = gltf["bufferViews"][acc["bufferView"]]
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    fmt, sz = COMP[acc["componentType"]]
    n = NCOMP[acc["type"]]
    stride = bv.get("byteStride") or (sz * n)
    out = []
    for k in range(acc["count"]):
        vals = struct.unpack_from("<" + fmt * n, BIN, base + k * stride)
        out.append(vals if n > 1 else vals[0])
    return out


print("meshes:", len(gltf.get("meshes", [])), "nodes:", len(gltf.get("nodes", [])))
tot_tri = 0
degenerate = 0
outlier = 0
worst = []
minv = [1e9] * 3
maxv = [-1e9] * 3

for mi, mesh in enumerate(gltf["meshes"]):
    for pi, prim in enumerate(mesh["primitives"]):
        pos = read_accessor(prim["attributes"]["POSITION"])
        idx = read_accessor(prim["indices"]) if "indices" in prim else list(range(len(pos)))
        for p in pos:
            for k in range(3):
                minv[k] = min(minv[k], p[k])
                maxv[k] = max(maxv[k], p[k])
        nt = len(idx) // 3
        tot_tri += nt
        for t in range(nt):
            a, b, c = pos[idx[3 * t]], pos[idx[3 * t + 1]], pos[idx[3 * t + 2]]
            ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
            vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
            cx = uy * vz - uz * vy
            cy = uz * vx - ux * vz
            cz = ux * vy - uy * vx
            area = 0.5 * math.sqrt(cx * cx + cy * cy + cz * cz)
            if area < 1e-7:
                degenerate += 1
                if len(worst) < 8:
                    worst.append(("degenerate", mi, pi, t, round(area, 10), a, b, c))
            # 顶点离群：离校园中心 (0,0) 超过 3000 m，或高度异常
            for p in (a, b, c):
                if abs(p[0]) > 3000 or abs(p[2]) > 3000 or p[1] < -20 or p[1] > 300:
                    outlier += 1
                    if len(worst) < 12:
                        worst.append(("outlier", mi, pi, t, round(area, 3), a, b, c))
                    break

print("三角形总数:", tot_tri)
print("退化三角形:", degenerate)
print("含离群顶点的三角形:", outlier)
print("包围盒 x[%.1f, %.1f] y[%.1f, %.1f] z[%.1f, %.1f]" % (minv[0], maxv[0], minv[1], maxv[1], minv[2], maxv[2]))
for w in worst:
    print("  ", w[0], "mesh", w[1], "prim", w[2], "tri", w[3], "area", w[4])
    print("      ", [tuple(round(x, 2) for x in p) for p in w[5:8]])
