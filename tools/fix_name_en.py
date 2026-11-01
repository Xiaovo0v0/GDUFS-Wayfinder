# -*- coding: utf-8 -*-
"""修英文地名：把 "Yunshan Dorm 十三" 这类残留的中文数字换成阿拉伯数字，并补新条目。

用法：python tools/fix_name_en.py
"""
import io
import json
import re

PATH = r"gdufs-3d/name-en.js"
CN = {
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
    "十": 10, "十一": 11, "十二": 12, "十三": 13, "十四": 14, "十五": 15,
    "十六": 16, "十七": 17, "十八": 18, "十九": 19, "二十": 20,
}

raw = io.open(PATH, encoding="utf-8").read()
m = re.search(r"window\.GDUFS_NAME_EN\s*=\s*(\{.*\});?\s*$", raw, re.S)
data = json.loads(m.group(1))
print("原条目", len(data))

fixed = 0
for k, v in list(data.items()):
    def sub(mt):
        global fixed
        cn = mt.group(2)
        if cn in CN:
            fixed += 1
            return mt.group(1) + str(CN[cn])
        return mt.group(0)
    nv = re.sub(r"(\b(?:Dorm|Building|Hall|Room)\s*)([一二三四五六七八九十]{1,3})\b", sub, v)
    if nv != v:
        data[k] = nv

# 补：八角楼
data.setdefault("八角楼", "Octagon Hall")

# 排序输出，便于 diff
out = "window.GDUFS_NAME_EN = " + json.dumps(
    dict(sorted(data.items(), key=lambda kv: kv[0])), ensure_ascii=False, separators=(",", ":")
) + ";\n"
io.open(PATH, "w", encoding="utf-8", newline="\n").write(out)
print("修数字", fixed, "处；条目", len(data))

bad = [v for v in data.values() if re.search(r"[一二三四五六七八九十]", v)]
print("仍含中文数字的条目:", bad[:8], "" if not bad else "共 %d 条" % len(bad))
