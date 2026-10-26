# -*- coding: utf-8 -*-
"""
用 Blender(headless) 把校园建筑体块生成 LOD2 模型并导出 GLB。

输入: artifacts/blender/buildings.json  (局部米制坐标: x=西正, z=北, y=高)
贴图: artifacts/blender/tex/*.png       (1 tile = 3.6m x 3.6m)
输出: gdufs-3d/assets/gdufs_buildings.glb

运行: blender --background --python tools/blender_build.py
"""
import bpy
import bmesh
import json
import math
import os
import random

ROOT = r"C:\Users\86134\Desktop\gdufs"
# 可用环境变量指定输入与输出，方便同一套脚本生成北校区
SRC = os.environ.get("GDUFS_SRC") or os.path.join(ROOT, "artifacts", "blender", "buildings.json")
TEX = os.path.join(ROOT, "artifacts", "blender", "tex")
OUT = os.environ.get("GDUFS_OUT") or os.path.join(ROOT, "gdufs-3d", "assets")
os.makedirs(OUT, exist_ok=True)

BAY = 3.6
FLOOR = 3.6

with open(SRC, encoding="utf-8") as f:
    DATA = json.load(f)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------------------------------------------------------------- materials
def srgb(c):
    return (c / 255.0) ** 2.2


def solid_mat(name, rgb, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (srgb(rgb[0]), srgb(rgb[1]), srgb(rgb[2]), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    return m


def tex_mat(name, path):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.88
    b.inputs["Metallic"].default_value = 0.0
    img = bpy.data.images.load(path, check_existing=True)
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    t.interpolation = "Closest"
    t.extension = "REPEAT"
    nt.links.new(b.inputs["Base Color"], t.outputs["Color"])
    return m


PALS = ("cold", "sand", "terra")
KINDS = ("ribbon", "punch", "curtain", "large", "panel")

MATS = {}
for kind in KINDS:
    for pal in PALS:
        MATS[(kind, pal)] = tex_mat("facade_%s_%s" % (kind, pal),
                                    os.path.join(TEX, "%s_%s.png" % (kind, pal)))
    # 兜底：老命名的那张
    MATS[(kind, None)] = tex_mat("facade_" + kind, os.path.join(TEX, kind + ".png"))
MAT_ROOF = tex_mat("roof", os.path.join(TEX, "roof.png"))
MAT_ROOF.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.95
for _n in MAT_ROOF.node_tree.nodes:
    if _n.type == "TEX_IMAGE":
        _n.interpolation = "Linear"
MAT_ROOF2 = solid_mat("roof_dark", (85, 89, 92))
MAT_ACCENT = solid_mat("accent", (120, 100, 88))
MAT_METAL = solid_mat("metal", (150, 154, 156), 0.6)
MAT_PLINTH = solid_mat("plinth", (92, 95, 98), 0.95)


# ---------------------------------------------------------------- geometry
def ring_area(ring):
    s = 0.0
    n = len(ring)
    for i in range(n):
        x1, z1 = ring[i]
        x2, z2 = ring[(i + 1) % n]
        s += x1 * z2 - x2 * z1
    return s * 0.5


def point_in_ring(x, z, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, zi = ring[i]
        xj, zj = ring[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def uv_ring_quads(ring, y0, y1, u_off, uv_scale_u, uv_scale_v):
    """返回 (verts, face, uvs) 的墙面四边形，逆时针朝外。"""
    out_v, out_f, out_uv = [], [], []
    n = len(ring)
    cx = sum(p[0] for p in ring) / n
    cz = sum(p[1] for p in ring) / n
    cum = 0.0
    for i in range(n):
        p0 = ring[i]
        p1 = ring[(i + 1) % n]
        dx, dz = p1[0] - p0[0], p1[1] - p0[1]
        L = math.hypot(dx, dz)
        if L < 0.05:
            continue
        nx, nz = dz / L, -dx / L
        mx, mz = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        if (mx - cx) * nx + (mz - cz) * nz < 0:
            nx, nz = -nx, -nz
        u0 = (u_off + cum) * uv_scale_u
        u1 = (u_off + cum + L) * uv_scale_u
        v0, v1 = y0 * uv_scale_v, y1 * uv_scale_v
        base = len(out_v)
        # Blender 坐标 = (x, -z, 高)
        out_v += [
            (p0[0], -p0[1], y0),
            (p0[0], -p0[1], y1),
            (p1[0], -p1[1], y1),
            (p1[0], -p1[1], y0),
        ]
        out_f.append((base, base + 1, base + 2, base + 3))
        out_uv.append([(u0, v0), (u0, v1), (u1, v1), (u1, v0)])
        cum += L
    return out_v, out_f, out_uv, cum


def build_building(b):
    verts, faces, uvs, mat_idx = [], [], [], []

    # 每栋楼一个稳定种子：决定配色与贴图相位，避免 51 栋长得一模一样
    seed = 0
    for i, ch in enumerate(b["id"]):
        seed = (seed * 131 + ord(ch) * (i + 1)) & 0xFFFFFF
    pal = PALS[seed % len(PALS)]
    u_phase = (seed % 89) / 7.0

    def add(part_v, part_f, part_uv, mi):
        base = len(verts)
        verts.extend(part_v)
        for f, uv in zip(part_f, part_uv):
            faces.append(tuple(i + base for i in f))
            uvs.append(uv)
            mat_idx.append(mi)

    # 立面
    total = 0.0
    for ring in b["rings"]:
        v, f, u, L = uv_ring_quads(ring, 0.0, b["height"], total / BAY + u_phase, 1 / BAY, 1 / FLOOR)
        add(v, f, u, 0)  # 0 = 贴图材质
        total += L

    # 勒脚：底下一圈深色，把楼"压"在地上，远看更有分量
    plinth_h = 1.1
    for ring in b["rings"]:
        n = len(ring)
        cx0 = sum(p[0] for p in ring) / n
        cz0 = sum(p[1] for p in ring) / n
        for i in range(n):
            p0, p1 = ring[i], ring[(i + 1) % n]
            dx, dz = p1[0] - p0[0], p1[1] - p0[1]
            L = math.hypot(dx, dz)
            if L < 0.05:
                continue
            nx, nz = dz / L, -dx / L
            mx, mz = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
            if (mx - cx0) * nx + (mz - cz0) * nz < 0:
                nx, nz = -nx, -nz
            ox, oz = nx * 0.06, nz * 0.06
            base = len(verts)
            verts += [
                (p0[0] + ox, -(p0[1] + oz), 0.0),
                (p0[0] + ox, -(p0[1] + oz), plinth_h),
                (p1[0] + ox, -(p1[1] + oz), plinth_h),
                (p1[0] + ox, -(p1[1] + oz), 0.0),
            ]
            faces.append((base, base + 1, base + 2, base + 3))
            uvs.append([(0.0, 0.0)] * 4)
            mat_idx.append(4)

    # 屋顶
    for ring in b["rings"]:
        n = len(ring)
        cap = [(p[0], -p[1], b["height"]) for p in ring]
        base = len(verts)
        verts.extend(cap)
        faces.append(tuple(base + i for i in range(n)))
        uvs.append([(p[0] / 8.0, p[1] / 8.0) for p in ring])
        mat_idx.append(1)

    # 女儿墙
    h = b["height"]
    for ring in b["rings"]:
        n = len(ring)
        cx = sum(p[0] for p in ring) / n
        cz = sum(p[1] for p in ring) / n
        for i in range(n):
            p0, p1 = ring[i], ring[(i + 1) % n]
            dx, dz = p1[0] - p0[0], p1[1] - p0[1]
            L = math.hypot(dx, dz)
            if L < 0.05:
                continue
            nx, nz = dz / L, -dx / L
            mx, mz = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
            if (mx - cx) * nx + (mz - cz) * nz < 0:
                nx, nz = -nx, -nz
            ox, oz = nx * 0.20, nz * 0.20
            base = len(verts)
            verts += [
                (p0[0] + ox, -(p0[1] + oz), h - 0.25),
                (p0[0] + ox, -(p0[1] + oz), h + 0.65),
                (p1[0] + ox, -(p1[1] + oz), h + 0.65),
                (p1[0] + ox, -(p1[1] + oz), h - 0.25),
            ]
            faces.append((base, base + 1, base + 2, base + 3))
            uvs.append([(0.0, 0.0)] * 4)
            mat_idx.append(2)

    # 屋顶设备
    rnd = random.Random(sum(ord(c) for c in b["id"]))
    ring0 = b["rings"][0]
    if b.get("area", 0) > 1200 and b["type"] != "sports":
        minx = min(p[0] for p in ring0); maxx = max(p[0] for p in ring0)
        minz = min(p[1] for p in ring0); maxz = max(p[1] for p in ring0)
        for _ in range(2 + rnd.randint(0, 2)):
            w = 3 + rnd.random() * 4
            d = 3 + rnd.random() * 4
            bh = 1.2 + rnd.random() * 1.6
            px = minx + 2 + rnd.random() * max(1.0, (maxx - minx) - 4)
            pz = minz + 2 + rnd.random() * max(1.0, (maxz - minz) - 4)
            if not point_in_ring(px, pz, ring0):
                continue
            base = len(verts)
            x0, x1 = px - w / 2, px + w / 2
            y0, y1 = -(pz + d / 2), -(pz - d / 2)
            z0, z1 = h, h + bh
            vs = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                  (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
            verts += vs
            for q in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
                faces.append(tuple(base + i for i in q))
                uvs.append([(0.0, 0.0)] * 4)
                mat_idx.append(3)

    # 入口雨棚（在 access 点附近）
    acc = b.get("access")
    if acc and b.get("area", 0) > 600:
        ax, az = acc[0], acc[1]
        # 找最近的环边，取切线方向
        best = None
        for ring in b["rings"]:
            n = len(ring)
            for i in range(n):
                p0, p1 = ring[i], ring[(i + 1) % n]
                ex, ez = p1[0] - p0[0], p1[1] - p0[1]
                L2 = ex * ex + ez * ez
                if L2 < 1e-6:
                    continue
                t = max(0.0, min(1.0, ((ax - p0[0]) * ex + (az - p0[1]) * ez) / L2))
                qx, qz = p0[0] + ex * t, p0[1] + ez * t
                dd = (qx - ax) ** 2 + (qz - az) ** 2
                if best is None or dd < best[0]:
                    best = (dd, ex / math.sqrt(L2), ez / math.sqrt(L2), qx, qz)
        if best:
            _, tx, tz, qx, qz = best
            nx, nz = -tz, tx
            # 朝外
            cx = sum(p[0] for p in ring0) / len(ring0)
            cz = sum(p[1] for p in ring0) / len(ring0)
            if (qx - cx) * nx + (qz - cz) * nz < 0:
                nx, nz = -nx, -nz
            # 雨棚平面沿切线 9m、沿法线 4m，高 3.9m
            hw, hd = 4.5, 2.2
            ox, oz = qx + nx * 1.6, qz + nz * 1.6
            corners = []
            for sx, sd in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                corners.append((ox + tx * hw * sx + nx * hd * sd,
                                oz + tz * hw * sx + nz * hd * sd))
            base = len(verts)
            y0, y1 = -(corners[0][1]), -(corners[1][1])
            pts = [(corners[0][0], -(corners[0][1])), (corners[1][0], -(corners[1][1])),
                   (corners[2][0], -(corners[2][1])), (corners[3][0], -(corners[3][1]))]
            zt, zb = 4.1, 3.7
            for zz in (zt, zb):
                for p in pts:
                    verts.append((p[0], p[1], zz))
            for q in ((4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
                faces.append(tuple(base + i for i in q))
                uvs.append([(0.0, 0.0)] * 4)
                mat_idx.append(2)

    if not verts:
        return None

    me = bpy.data.meshes.new("mesh_" + b["id"])
    me.from_pydata(verts, [], faces)
    me.update()

    # UV
    uvl = me.uv_layers.new(name="UVMap")
    li = 0
    for pi, poly in enumerate(me.polygons):
        for k in range(poly.loop_total):
            uv = uvs[pi][k] if pi < len(uvs) and k < len(uvs[pi]) else (0.0, 0.0)
            uvl.data[li].uv = uv
            li += 1

    # 材质槽：0 贴图立面 / 1 屋顶 / 2 女儿墙+雨棚 / 3 屋顶设备
    kind = b["style"]["kind"]
    me.materials.append(MATS.get((kind, pal)) or MATS[(kind, None)])
    me.materials.append(MAT_ROOF)
    me.materials.append(MAT_ACCENT)
    me.materials.append(MAT_METAL)
    me.materials.append(MAT_PLINTH)
    for pi, poly in enumerate(me.polygons):
        poly.material_index = mat_idx[pi] if pi < len(mat_idx) else 0

    ob = bpy.data.objects.new(b["id"], me)
    scene.collection.objects.link(ob)
    ob["building_id"] = b["id"]
    ob["building_name"] = b["name"]
    ob["building_type"] = b["type"]

    # 修正法线
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    return ob


count = 0
failed = []
for b in DATA["buildings"]:
    try:
        if build_building(b):
            count += 1
    except Exception as e:
        failed.append((b.get("id"), str(e)))
        print("FAILED", b.get("id"), e)

print("built", count, "failed", len(failed))

glb = os.path.join(OUT, os.environ.get("GDUFS_NAME") or "gdufs_buildings.glb")
bpy.ops.export_scene.gltf(
    filepath=glb,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    use_selection=False,
)
print("exported", glb, os.path.getsize(glb), "bytes")
