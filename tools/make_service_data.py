"""把 service_items.json + place_map.json 合成前端可直接加载的 service-data.js。

字段设计（前端卡片按这一份渲染）：
  sid / title / dept / hours / materials / steps / phone / url / src
  south[] / north[]  每个是 {building_id, name, room, campus}
  online              是否可线上办理
  confidence          定位精度
"""

import json
import os

SERVICE = r"data\service_guide\service_items.json"
PLACE = r"data\service_guide\place_map.json"
OUT = r"gdufs-3d\service-data.js"

items = json.load(open(SERVICE, encoding="utf-8"))
pm = json.load(open(PLACE, encoding="utf-8"))["items"]

out = []
for idx, it in enumerate(items, 1):
    sid = "S%02d" % idx
    p = pm.get(sid, {})

    def clean(lst):
        res = []
        for e in lst or []:
            res.append({
                "building_id": e.get("building_id"),
                "name": e.get("building_name"),
                "room": e.get("room"),
            })
        return res

    out.append({
        "sid": sid,
        "title": it.get("title"),
        "dept": it.get("department"),
        "hours": it.get("hours"),
        "materials": it.get("materials") or [],
        "steps": it.get("steps") or [],
        "phone": it.get("phone") or "",
        "url": it.get("online_url") or "",
        "src": (it.get("sources") or [""])[0] if it.get("sources") else "",
        "south": clean(p.get("south")),
        "north": clean(p.get("north")),
        "online": bool(p.get("online")),
        "confidence": p.get("confidence", "low"),
    })

js = "window.GDUFS_SERVICE = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
open(OUT, "w", encoding="utf-8").write(js)
print("输出 %s  %d 条  %.1f KB" % (OUT, len(out), os.path.getsize(OUT) / 1024))
