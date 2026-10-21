# -*- coding: utf-8 -*-
"""生成中英地名对照表 gdufs-3d/name-en.js。

规则优先（宿舍/教学楼/实验楼这类有规律的批量生成），
其余建筑用显式对照；官方英文名能查到的优先用官方写法。
"""
import json
import os
import re

SOUTH = r"gdufs-3d\gdufs-data.js"
NORTH = r"data\official\north_buildings.json"
OUT = r"gdufs-3d\name-en.js"

# 显式对照（官方或通行译名）
EXPLICIT = {
    "图书馆": "Library",
    "大会堂（教工活动中心）": "Grand Hall (Staff Activity Center)",
    "院系办公楼": "Faculty Office Building",
    "行政办公楼": "Administration Building",
    "学生活动中心": "Student Activity Center",
    "后勤楼": "Logistics Building",
    "博雅园（第二饭堂）": "Boyayuan (Canteen 2)",
    "文采园（第一饭堂）": "Wencaiyuan (Canteen 1)",
    "风采园（第三饭堂）": "Fengcaiyuan (Canteen 3)",
    "门诊部（校医院）": "Clinic (Campus Hospital)",
    "门诊部": "Clinic",
    "B8学术报告厅": "B8 Lecture Hall",
    "体育场看台": "Stadium Stand",
    "体育馆（羽毛球馆）": "Gymnasium (Badminton)",
    "艺术楼": "Arts Building",
    "学术交流中心": "Academic Exchange Center",
    "第六教学楼": "Teaching Building 6",
    "第二教学楼": "Teaching Building 2",
    "第三教学楼": "Teaching Building 3",
    "第四教学楼": "Teaching Building 4",
    "第七教学楼": "Teaching Building 7",
    "逸林酒店": "Yilin Hotel",
    "第一学生食堂": "Canteen 1",
    "第二学生食堂": "Canteen 2",
    "学生服务大厅": "Student Service Hall",
    "云山会堂": "Yunshan Auditorium",
    "干训楼": "Staff Training Building",
    "BBA教育中心": "BBA Education Center",
    "保卫处": "Security Office",
    "行政楼": "Administration Building",
    "师苑（C16/C18）": "Shiyuan Dorm (C16/C18)",
    # 校门
    "正门": "Main Gate",
    "行政出入口": "Administration Gate",
    "1号门（中环路·隧道旁）": "Gate 1 (Zhonghuan Rd · by tunnel)",
    "2号门": "Gate 2",
    "3号门（外环西路·学生活动中心旁）": "Gate 3 (Waihuan West Rd)",
    "4号门": "Gate 4",
}


def translate(name):
    if not name:
        return name
    if name in EXPLICIT:
        return EXPLICIT[name]
    m = re.fullmatch(r"教学楼([A-G])栋", name)
    if m:
        return "Teaching Building %s" % m.group(1)
    m = re.fullmatch(r"实验楼([A-E])区", name)
    if m:
        return "Lab Building %s" % m.group(1)
    m = re.fullmatch(r"北苑(\d+)栋", name)
    if m:
        return "Beiyuan Dorm %s" % m.group(1)
    m = re.fullmatch(r"南苑(\d+)栋", name)
    if m:
        return "Nanyuan Dorm %s" % m.group(1)
    m = re.fullmatch(r"师苑(\d+)栋", name)
    if m:
        return "Shiyuan Dorm %s" % m.group(1)
    m = re.fullmatch(r"云山(.+)栋", name)
    if m:
        return "Yunshan Dorm %s" % m.group(1)
    return name


t = open(SOUTH, encoding="utf-8").read()
s = json.loads(t[t.index("{"):t.rindex(";")])
n = json.load(open(NORTH, encoding="utf-8"))

names = set()
for b in s["buildings"]:
    if b.get("name"):
        names.add(b["name"])
for g in s.get("gates", []):
    if g.get("name"):
        names.add(g["name"])
names.add("行政出入口")
for b in n["buildings"]:
    if b.get("name"):
        names.add(b["name"])

mapping = {k: translate(k) for k in sorted(names)}
missing = [k for k, v in mapping.items() if v == k]
print("共 %d 条，未翻译 %d 条" % (len(mapping), len(missing)))
for m in missing:
    print("  未译:", m)

js = "window.GDUFS_NAME_EN = " + json.dumps(mapping, ensure_ascii=False, indent=0).replace("\n", "") + ";\n"
open(OUT, "w", encoding="utf-8").write(js)
print("输出", OUT, os.path.getsize(OUT), "bytes")
