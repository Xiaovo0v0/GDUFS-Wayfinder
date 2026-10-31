# -*- coding: utf-8 -*-
"""修正 north-data.js 的 meta：数据来源写错成南校区平面图 n.jpg，实际是北校区 b.jpg。"""
import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "gdufs-3d", "north-data.js")


def main():
    raw = io.open(DATA, encoding="utf-8").read()
    i = raw.index("{")
    j = raw.rindex("}")
    head, tail = raw[:i], raw[j + 1:]
    D = json.loads(raw[i:j + 1])

    xs = [p[0] for ring in D["boundary"] for p in ring]
    zs = [p[1] for ring in D["boundary"] for p in ring]
    hs = [b.get("height") or 0 for b in D["buildings"]]
    D["meta"]["bounds_m"] = {
        "x": [round(min(xs), 1), round(max(xs), 1)],
        "z": [round(min(zs), 1), round(max(zs), 1)],
        "y": [0, round(max(hs), 1)],
    }
    D["meta"]["note"] = (
        "建筑轮廓/校门/地名来自校方公开的北校区平面图 b.jpg（10488x8787，"
        "经道路掩膜互相关标定，与 assets 栅格 IoU 0.966，0.4178 m/px）；"
        "道路与相思河由 b.jpg 栅格矢量化而来（skimage 骨架 + 实测路宽），"
        "宿舍区人行道按「门口接驳 + 最小生成树」合成；"
        "边界取建筑群凹包外扩 26 m 并并入贴边道路，面积 37.4 万 m2。"
        "坐标系与南校区一致：x 轴指向西、z 轴指向北、y 为高度，单位为米。"
    )
    D["meta"]["sources"] = [
        "https://yx.gdufs.edu.cn/b.jpg （官方北校区平面图，建筑/道路/水系/操场底图）",
    ]
    txt = head + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + tail
    io.open(DATA, "w", encoding="utf-8", newline="").write(txt)
    io.open(os.path.join(HERE, "..", "artifacts", "north", "meta_check.txt"), "w",
            encoding="utf-8").write(json.dumps(D["meta"], ensure_ascii=False, indent=1))
    print("ok", len(txt.encode("utf-8")) / 1024.0, "KB")


if __name__ == "__main__":
    main()
