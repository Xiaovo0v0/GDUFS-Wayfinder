# -*- coding: utf-8 -*-
"""把三个来源的楼名对齐成一份「主名 + 别名」表，并把打架的地方单列出来。

输入：artifacts/lock/names_north.csv / names_south.csv（build_names.py 的产物，
      一行一个命名要素，带 来源 / 模型ID / 局部坐标）
输出：artifacts/lock/names_canonical.json  —— 每栋楼一条：主名、别名、来源、冲突标记
      artifacts/lock/names_conflicts.md    —— 需要人拍板的冲突清单

规则：
  1. 主名 = 校方平面图给的名字（模型自带），没有再退到高德转录名，最后退到 OSM。
  2. 别名 = ① 中文数字/阿拉伯数字互写（云山一栋 ↔ 云山学1栋 ↔ 1栋）
            ② 同一位置 60 m 内其它来源的名字。
  3. 冲突 = 同一个名字落到两栋楼上（重名），或同一栋楼两个来源的名字对不上（异名）。
"""
import io
import json
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "artifacts", "lock")

CN = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
      "十": 10, "十一": 11, "十二": 12, "十三": 13, "十四": 14, "十五": 15,
      "十六": 16, "十七": 17, "十八": 18, "十九": 19}
CN_REV = {v: k for k, v in CN.items()}


def read_rows(campus):
    import csv
    p = os.path.join(ART, "names_%s.csv" % campus)
    rows = list(csv.reader(io.open(p, encoding="utf-8-sig")))
    head = rows[0]
    i = {h: n for n, h in enumerate(head)}
    out = []
    for r in rows[1:]:
        out.append({
            "name": r[i["名称"]], "kind": r[i["类别"]], "source": r[i["来源"]],
            "id": r[i["模型ID"]], "x": float(r[i["局部x"]]), "z": float(r[i["局部z"]]),
            "lat": r[i["纬度WGS84"]], "lon": r[i["经度WGS84"]], "note": r[i["备注"]],
        })
    return out


def spellings(name):
    """同一栋楼在不同来源里可能写成什么样。"""
    forms = set()
    n = name.strip()
    if not n:
        return forms
    forms.add(n)
    # 云山三栋 / 云山学3栋
    m = re.match(r"^云山(?:学)?(十[一二三四五六七八九]|[一二三四五六七八九]|\d{1,2})栋$", n)
    if m:
        tok = m.group(1)
        num = CN.get(tok) or (int(tok) if tok.isdigit() else None)
        if num:
            forms.update({"云山%s栋" % CN_REV.get(num, num), "云山学%s栋" % num, "%d栋" % num})
    # 南苑7栋 / 北苑7栋 / 师苑7栋 / 7栋
    m = re.match(r"^(南苑|北苑|师苑)(\d{1,2})栋$", n)
    if m:
        forms.add("%s栋" % m.group(2))
        forms.add("宿舍%s栋" % m.group(2))
    # 教工宿舍26栋 / 26栋
    m = re.match(r"^教工宿舍(\d{1,3})栋$", n)
    if m:
        forms.add("%s栋" % m.group(1))
    # 去掉括号里的解释：师苑（C16/C18） → 师苑
    forms.add(re.sub(r"[（(].*?[）)]", "", n))
    return {f for f in forms if f}


def main():
    canon = []
    for campus, label in (("north", "白云山校区"), ("south", "大学城校区")):
        rows = read_rows(campus)
        model = [r for r in rows if r["source"] == "官方平面图"]
        osm = [r for r in rows if r["source"] == "OSM" and r["kind"].startswith("building")]

        def nearest(src, pool):
            best, bd = None, 1e9
            for e in pool:
                d = math.hypot(e["x"] - src["x"], e["z"] - src["z"])
                if d < bd:
                    best, bd = e, d
            return best, bd

        # 互为最近 + 60 m 以内才算同一栋楼，避免密集宿舍区串名
        pair = {}
        for m in model:
            e, d = nearest(m, osm)
            if e is not None and d <= 20:
                back, bd = nearest(e, model)
                if back is not None and back["id"] == m["id"]:
                    pair[m["id"]] = e

        for m in model:
            aliases = {}

            def add(a, src):
                a = (a or "").strip()
                if a and a != m["name"]:
                    aliases.setdefault(a, src)

            for f in spellings(m["name"]):
                add(f, "写法变体")
            e = pair.get(m["id"])
            if e is not None:
                add(e["name"], "OSM 同位置")
                for f in spellings(e["name"]):
                    add(f, "OSM 同位置")
            canon.append({
                "campus": label, "id": m["id"], "canonical": m["name"] or None,
                "type": m["kind"].split("=")[-1],
                "x": m["x"], "z": m["z"], "lat": m["lat"], "lon": m["lon"],
                "aliases": sorted(aliases), "alias_sources": aliases,
                "note": m["note"],
            })

    # 冲突 1：同一个别名指向多栋楼
    owner = {}
    for c in canon:
        for a in c["aliases"]:
            owner.setdefault(a, []).append(c)
    dup = {a: cs for a, cs in owner.items() if len(cs) > 1}

    # 冲突 2：一栋楼被别的来源叫成了完全不同的名字（60 m 内、互不包含）
    renamed = []
    for c in canon:
        for a, src in c["alias_sources"].items():
            if src != "OSM 同位置" or not c["canonical"]:
                continue
            if re.match(r"^\d+[A-Za-z]?栋?$", a):
                continue
            ca, aa = c["canonical"], a
            if ca in aa or aa in ca:
                continue
            renamed.append((c["id"], c["canonical"], a))

    json.dump({"generated": "2026-11-01", "campus": ["白云山校区", "大学城校区"],
               "rows": canon}, io.open(os.path.join(ART, "names_canonical.json"), "w",
                                       encoding="utf-8"), ensure_ascii=False, indent=1)

    md = ["# 楼名冲突清单", "",
          "三个来源（校方平面图 / 高德注记 / OSM）对不上时，谁也不是绝对对。",
          "这里只列需要人拍板的，能自动对齐的（云山三栋 ↔ 云山学3栋）不出现在下面。", "",
          "## 1. 一个名字对应多栋楼（%d 例）" % len(dup), "",
          "搜「%s」会落到哪栋，取决于匹配顺序 —— 这就是必须做别名表的原因。"
          % "、".join(list(dup)[:3]) if dup else "_无_", ""]
    if dup:
        md += ["| 名字 | 候选 |", "| --- | --- |"]
        for a, cs in sorted(dup.items(), key=lambda kv: -len(kv[1])):
            md.append("| %s | %s |" % (a, "<br>".join(
                "%s %s（%s）" % (c["campus"], c["id"], c["canonical"] or "无名") for c in cs)))
        md.append("")
    md += ["## 2. 同一栋楼两个名字（%d 例）" % len(renamed), ""]
    if renamed:
        md += ["| 模型 ID | 模型主名 | OSM 叫法 |", "| --- | --- | --- |"]
        for i, ca, aa in renamed:
            md.append("| %s | %s | %s |" % (i, ca, aa))
    else:
        md.append("_无_")
    md += ["", "## 3. 无主名的楼", ""]
    for c in canon:
        if not c["canonical"]:
            md.append("- %s %s（局部 x=%.1f z=%.1f）别名：%s"
                      % (c["campus"], c["id"], c["x"], c["z"], "、".join(c["aliases"]) or "无"))
    io.open(os.path.join(ART, "names_conflicts.md"), "w", encoding="utf-8",
            newline="").write("\n".join(md) + "\n")

    n_alias = len([c for c in canon if c["aliases"]])
    print("canonical rows %d, 有别名 %d, 重名组 %d, 异名 %d"
          % (len(canon), n_alias, len(dup), len(renamed)))


if __name__ == "__main__":
    main()
