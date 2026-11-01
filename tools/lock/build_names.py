# -*- coding: utf-8 -*-
"""把两个校区的建筑名汇总成一张表：模型自带的名字 + OSM 的名字，互为补充。

产出：
  artifacts/lock/names_north.csv / names_south.csv   —— 每栋一行（UTF-8 BOM，Excel 直接开）
  artifacts/lock/names.md                            —— 两份表格的 Markdown 版
列：校区, 名称, 类别, 来源, 模型ID, 局部x, 局部z, 纬度, 经度, GCJ纬度, GCJ经度, 备注
"""
import io
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gcj import wgs2gcj  # noqa: E402

KZ = 110540.0
D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(D, "..", ".."))


def load_js(rel):
    s = io.open(os.path.join(ROOT, rel), encoding="utf-8").read()
    return json.loads(s[s.index("{"):].rstrip().rstrip(";"))


def project(lat, lon, o_lat, o_lon):
    kx = 111320.0 * math.cos(math.radians(o_lat))
    return -(lon - o_lon) * kx, (lat - o_lat) * KZ


def norm(s):
    return "".join(ch for ch in (s or "") if ch.isalnum())


def centroid_of(bd):
    """南校区数据没有 centroid 字段，用外环面积重心补一个。"""
    if bd.get("centroid"):
        return bd["centroid"][0], bd["centroid"][1]
    ring = (bd.get("rings") or [[]])[0]
    a = cx = cz = 0.0
    for i in range(len(ring) - 1):
        x0, z0 = ring[i][0], ring[i][1]
        x1, z1 = ring[i + 1][0], ring[i + 1][1]
        cr = x0 * z1 - x1 * z0
        a += cr
        cx += (x0 + x1) * cr
        cz += (z0 + z1) * cr
    if abs(a) < 1e-9:
        xs = [p[0] for p in ring]
        zs = [p[1] for p in ring]
        return sum(xs) / len(xs), sum(zs) / len(zs)
    a *= 0.5
    return cx / (6 * a), cz / (6 * a)


def inside(b, x, z, pad=0.0):
    return (b["x"][0] - pad <= x <= b["x"][1] + pad) and (b["z"][0] - pad <= z <= b["z"][1] + pad)


def osm_named(path, b, o_lat, o_lon, pad=60.0):
    """OSM 里落在校区范围内、且带名字的要素。"""
    d = json.load(io.open(path, encoding="utf-8"))
    keep = ("building", "amenity", "leisure", "shop", "office", "landuse", "highway", "natural")
    out = []
    for e in d["elements"]:
        tags = e.get("tags") or {}
        nm = tags.get("name")
        if not nm:
            continue
        g = e.get("geometry") or []
        if g:
            lat = sum(p["lat"] for p in g) / len(g)
            lon = sum(p["lon"] for p in g) / len(g)
        elif e.get("lat"):
            lat, lon = e["lat"], e["lon"]
        else:
            continue
        x, z = project(lat, lon, o_lat, o_lon)
        if not inside(b, x, z, pad):
            continue
        kind = next((k for k in ("building", "amenity", "leisure", "shop", "office", "landuse", "highway") if tags.get(k)), "other")
        out.append({
            "name": nm,
            "kind": "%s=%s" % (kind, tags.get(kind)),
            "lat": lat, "lon": lon, "x": x, "z": z,
            "building": "building" in tags,
        })
    return out


def main():
    north = load_js("gdufs-3d/north-data.js")
    south = load_js("gdufs-3d/gdufs-data.js")
    jobs = [
        ("north", "白云山校区", north, "artifacts/lock/osm_north2.json"),
        ("south", "大学城校区", south, "artifacts/lock/osm_south.json"),
    ]
    all_rows = {}
    for key, label, data, osm_path in jobs:
        meta = data["meta"]
        o = meta["origin_wgs84"]
        b = meta["bounds_m"]
        rows = []
        # 1) 模型自己的建筑
        for bd in data["buildings"]:
            x, z = centroid_of(bd)
            lat = o["lat"] + z / KZ
            lon = o["lon"] - x / (111320.0 * math.cos(math.radians(o["lat"])))
            rows.append({
                "campus": label, "name": bd.get("name") or "", "kind": "building=" + (bd.get("type") or ""),
                "source": "官方平面图", "id": bd["id"], "x": round(x, 1), "z": round(z, 1),
                "lat": lat, "lon": lon, "note": "层数%d" % (bd.get("levels") or 0),
            })
        # 2) OSM 里带名字的
        osm = osm_named(os.path.join(ROOT, osm_path), b, o["lat"], o["lon"])
        by_name = {}
        for r in rows:
            n = norm(r["name"])
            if n:
                by_name.setdefault(n, []).append(r)
        added = matched = 0
        for e in osm:
            n = norm(e["name"])
            cand = by_name.get(n) or []
            # 名字完全一致的优先；否则找 25 m 内同名系（含包含关系）的模型建筑
            hit = None
            for r in cand:
                if math.hypot(r["x"] - e["x"], r["z"] - e["z"]) < 80:
                    hit = r
                    break
            if hit is None:
                for r in rows:
                    if not r["name"] or r["source"] != "官方平面图":
                        continue
                    d = math.hypot(r["x"] - e["x"], r["z"] - e["z"])
                    if d < 30 and (norm(r["name"]) in n or n in norm(r["name"])):
                        hit = r
                        break
            if hit is not None:
                hit["note"] = (hit["note"] + "；" if hit["note"] else "") + "OSM 同名/邻近核对"
                matched += 1
                continue
            outside = not (b["x"][0] <= e["x"] <= b["x"][1] and b["z"][0] <= e["z"] <= b["z"][1])
            note = "影像/OSM 补充（模型未建）" if e["building"] else ""
            if outside:
                note = (note + "；" if note else "") + "界外（邻近单位）"
            rows.append({
                "campus": label, "name": e["name"], "kind": e["kind"], "source": "OSM",
                "id": "", "x": round(e["x"], 1), "z": round(e["z"], 1),
                "lat": e["lat"], "lon": e["lon"], "note": note,
            })
            added += 1
        all_rows[key] = rows
        # 3) 模型里没名字的建筑：用 45 m 内唯一一栋 OSM 命名建筑补上（标为待核）
        used = set()
        taken = set(norm(r["name"]) for r in rows if r["name"] and r["source"] == "官方平面图")
        for r in rows:
            if r["name"]:
                used.add((round(r["x"]), round(r["z"])))
        filled = 0
        for r in rows:
            if r["name"] or r["source"] != "官方平面图":
                continue
            cands = [e for e in osm if e["building"] and e["name"]
                     and math.hypot(e["x"] - r["x"], e["z"] - r["z"]) < 45]
            if not cands:
                continue
            cands.sort(key=lambda e: math.hypot(e["x"] - r["x"], e["z"] - r["z"]))
            e = cands[0]
            if (round(e["x"]), round(e["z"])) in used or norm(e["name"]) in taken:
                continue
            if re.match(r"^\d+[A-Za-z]?栋?$", e["name"]):
                continue  # 纯编号不算名字
            r["name"] = e["name"]
            r["note"] = (r["note"] + "；" if r["note"] else "") + "名称由 OSM 邻近建筑推断，待人工确认"
            used.add((round(e["x"]), round(e["z"])))
            taken.add(norm(e["name"]))
            filled += 1
        print("  无名建筑按 OSM 补名 %d 栋" % filled)
        print("%s: model %d, osm %d, 核对上 %d, 新增 %d, 合计 %d"
              % (label, len(data["buildings"]), len(osm), matched, added, len(rows)))

    # 备注去重
    for key in all_rows:
        for r in all_rows[key]:
            if r["note"] and "；" in r["note"]:
                seen, parts = set(), []
                for s in r["note"].split("；"):
                    if s and s not in seen:
                        seen.add(s)
                        parts.append(s)
                r["note"] = "；".join(parts)

    # 写 CSV
    cols = ["campus", "name", "kind", "source", "id", "x", "z", "lat", "lon", "note"]
    for key, label in (("north", "白云山校区"), ("south", "大学城校区")):
        rows = all_rows[key]
        p = os.path.join(ROOT, "artifacts/lock/names_%s.csv" % key)
        with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
            f.write(",".join(["校区", "名称", "类别", "来源", "模型ID", "局部x", "局部z",
                              "纬度WGS84", "经度WGS84", "纬度GCJ02", "经度GCJ02", "备注"]) + "\n")
            for r in rows:
                g = wgs2gcj(r["lat"], r["lon"])
                cells = [r["campus"], r["name"], r["kind"], r["source"], r["id"],
                         _f(r["x"]), _f(r["z"]), "%.7f" % r["lat"], "%.7f" % r["lon"],
                         "%.7f" % g[0], "%.7f" % g[1], r["note"]]
                f.write(",".join('"%s"' % str(c).replace('"', '""') for c in cells) + "\n")
        print("wrote", p, len(rows))

    # 写 Markdown 版
    md = ["# 广外两校区建筑名录（自动汇总）", "",
          "来源三路：① 校方平面图矢量化后模型自带的名字（`north-data.js` / `gdufs-data.js`）；",
          "② OSM 里落进校界的命名要素（ODbL，`© OpenStreetMap contributors`）；",
          "③ 模型里没名字的楼，用 45 m 内唯一一栋 OSM 命名建筑反推（标注待核）。", ""]
    for key, label in (("north", "白云山校区"), ("south", "大学城校区")):
        rows = all_rows[key]
        model = [r for r in rows if r["source"] == "官方平面图"]
        extra = [r for r in rows if r["source"] == "OSM"]
        bld = [r for r in extra if r["kind"].startswith("building")]
        poi = [r for r in extra if not r["kind"].startswith("building")]
        unknown = [r for r in model if not r["name"]]
        md += ["## %s" % label, "",
               "模型 %d 栋；OSM 补充建筑 %d 条、其它设施/道路 %d 条；仍无名称 %d 栋。"
               % (len(model), len(bld), len(poi), len(unknown)), "",
               "### A. 模型已建模的楼", "",
               "| ID | 名称 | type | 层 | 局部 x,z (m) | WGS84 |", "| --- | --- | --- | --- | --- | --- |"]
        for r in model:
            nm = r["name"] or "**（待补）**"
            md.append("| %s | %s | %s | %s | %.1f, %.1f | %.6f, %.6f |"
                      % (r["id"], nm, r["kind"].split("=")[-1], (r["note"] or "—").split("；")[0].replace("层数", "") or "—",
                         r["x"], r["z"], r["lat"], r["lon"]))
        if bld:
            md += ["", "### B. OSM 有、模型未建的建筑", "",
                   "| 名称 | 类别 | 局部 x,z (m) | WGS84 |", "| --- | --- | --- | --- |"]
            for r in sorted(bld, key=lambda r: ("界外" in (r["note"] or ""), r["name"])):
                nm = ("⚠ " if "界外" in (r["note"] or "") else "") + r["name"]
                md.append("| %s | %s | %.1f, %.1f | %.6f, %.6f |"
                          % (nm, r["kind"].split("=")[-1], r["x"], r["z"], r["lat"], r["lon"]))
        if poi:
            md += ["", "### C. OSM 的其它命名要素（设施/道路/地块）", "",
                   "| 名称 | 类别 |", "| --- | --- |"]
            for r in sorted(poi, key=lambda r: r["name"]):
                md.append("| %s | %s |" % (r["name"], r["kind"]))
        md.append("")
    p = os.path.join(ROOT, "artifacts/lock/names.md")
    io.open(p, "w", encoding="utf-8", newline="").write("\n".join(md) + "\n")
    print("wrote", p)


def _f(v):
    return ("%g" % v) if v is not None else ""


if __name__ == "__main__":
    main()
