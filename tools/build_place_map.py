"""把办事事项的 location 文本解析成"校区 → 楼栋 → 房间"的结构化映射。

输出 data/service_guide/place_map.json，供：
  - 前端卡片"导航到这里"
  - Dify 的 place-lookup / materials-check 技能
"""
import json
import os
import re

SERVICE = r"data\service_guide\service_items.json"
SOUTH_JS = r"gdufs-3d\gdufs-data.js"
NORTH_JSON = r"data\official\north_buildings.json"
OUT = r"data\service_guide\place_map.json"

CAMPUS_PAT = [
    ("north", r"白云山|北校区|北校"),
    ("south", r"大学城|南校区|南校|小谷围|番禺"),
]

# 文本里常见的简称 → 数据里的正式名
ALIAS = {
    "行政楼": "行政办公楼",
    "校级行政楼": "行政办公楼",
    "办公大楼": "行政办公楼",
    "教学楼A座": "教学楼A栋",
    "教学楼B座": "教学楼B栋",
    "教学楼C座": "教学楼C栋",
    "教学楼D座": "教学楼D栋",
    "教学楼E座": "教学楼E栋",
    "教学楼F座": "教学楼F栋",
    "教学楼G座": "教学楼G栋",
    "校医院": "门诊部（校医院）",
    "一饭": "文采园（第一饭堂）",
    "二饭": "博雅园（第二饭堂）",
}


def load_south():
    t = open(SOUTH_JS, encoding="utf-8").read()
    d = json.loads(t[t.index("{"):t.rindex(";")])
    return [(b["id"], b["name"]) for b in d["buildings"] if b.get("name")]


def load_north():
    d = json.load(open(NORTH_JSON, encoding="utf-8"))
    return [("N%03d" % b["index"], b["name"]) for b in d["buildings"] if b.get("name")]


SOUTH = load_south()
NORTH = load_north()

# 长名优先，避免"图书馆"吃掉"图书馆东门"这类
ALL_NAMES = sorted({n for _, n in SOUTH} | {n for _, n in NORTH}, key=len, reverse=True)


def match_building(text, campus):
    pool = SOUTH if campus == "south" else NORTH if campus == "north" else SOUTH + NORTH
    for alias, formal in ALIAS.items():
        if alias in text:
            for bid, nm in pool:
                if nm == formal:
                    return bid, nm
    for nm in ALL_NAMES:
        if nm and nm in text:
            for bid, n in pool:
                if n == nm:
                    return bid, n
    return None, None


def split_segments(loc):
    parts = re.split(r"[；;、]", loc)
    out, cur = [], None
    for p in parts:
        p = p.strip()
        if not p:
            continue
        hit = None
        for code, pat in CAMPUS_PAT:
            if re.search(pat, p):
                hit = code
                break
        if hit:
            cur = hit
        out.append((cur, p))
    return out


items = json.load(open(SERVICE, encoding="utf-8"))
places = {}
named = 0

for idx, it in enumerate(items, 1):
    sid = "S%02d" % idx
    loc = it.get("location") or ""
    entries = {"south": [], "north": []}
    for campus, seg in split_segments(loc):
        if not campus:
            continue
        bid, bname = match_building(seg, campus)
        room = None
        m = re.search(r"(\d{3,4})\s*(?:室|房间)?", seg)
        if m:
            room = m.group(1)
        entries[campus].append({
            "building_id": bid,
            "building_name": bname,
            "room": room,
            "raw": seg,
        })

    # 另一校区已匹配到楼栋时，按名称主干做类比（如 行政楼 ↔ 行政办公楼）
    def analog(name, campus):
        core = re.sub(r"(楼|栋|堂|馆)$", "", name or "")
        if not core:
            return None, None
        pool = SOUTH if campus == "south" else NORTH
        best = None
        for bid, nm in pool:
            if core in nm:
                if best is None or len(nm) < len(best[1]):
                    best = (bid, nm)
        return best if best else (None, None)

    for c, other in (("south", "north"), ("north", "south")):
        donor = next((e["building_name"] for e in entries[other] if e["building_name"]), None)
        if not donor:
            continue
        for e in entries[c]:
            if not e["building_id"]:
                bid, nm = analog(donor, c)
                if bid:
                    e["building_id"], e["building_name"] = bid, nm
                    e["analogy"] = "按 %s 的楼栋名称类推" % donor

    online = bool(re.search(r"线上|网上|智慧广外|系统内|在线", loc))
    has_place = any(entries[c] for c in ("south", "north"))
    has_building = any(e["building_id"] for c in ("south", "north") for e in entries[c])
    if has_building:
        conf = "high"
        named += 1
    elif has_place:
        conf = "medium"
    else:
        conf = "low"

    places[sid] = {
        "title": it.get("title"),
        "department": it.get("department"),
        "south": entries["south"],
        "north": entries["north"],
        "online": online,
        "confidence": conf,
        "raw_location": loc,
    }

meta = {
    "source": "data/service_guide/service_items.json",
    "items": len(places),
    "with_building": named,
    "note": "building_id 来自 gdufs-data.js（南校 Bxxx）与 north_buildings.json（北校 Nxxx）；"
            "confidence=high 表示定位到具体楼栋，medium 只到校区，low 未识别",
}
json.dump({"meta": meta, "items": places}, open(OUT, "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

print("事项 %d，定位到楼栋 %d，校区级 %d，未识别 %d" % (
    len(places), named,
    sum(1 for v in places.values() if v["confidence"] == "medium"),
    sum(1 for v in places.values() if v["confidence"] == "low")))
print("输出", OUT, os.path.getsize(OUT), "bytes")
