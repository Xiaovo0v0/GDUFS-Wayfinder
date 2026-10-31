# -*- coding: utf-8 -*-
"""北校区矢量道路按类型出图，检查覆盖是否均匀（尤其宿舍区）。"""
import io
import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "gdufs-3d", "north-data.js")
OUT = os.path.join(ROOT, "artifacts", "north")

COLOR = {"primary": "#c0392b", "secondary": "#e67e22", "tertiary": "#f1c40f",
         "service": "#2980b9", "residential": "#8e44ad", "footway": "#27ae60",
         "path": "#16a085", "steps": "#7f8c8d"}


def load(path=DATA):
    raw = io.open(path, encoding="utf-8").read()
    i, j = raw.index("{"), raw.rindex("}")
    return json.loads(raw[i:j + 1])


def main():
    D = load()
    fig, ax = plt.subplots(figsize=(13, 13), dpi=100)
    for b in D.get("boundary") or []:
        ring = b.get("rings", [b])[0] if isinstance(b, dict) else b
        ax.plot([p[0] for p in ring], [p[1] for p in ring], "-", color="green", lw=1.2)
    for bd in D.get("buildings") or []:
        for r in bd.get("rings") or []:
            ax.fill([p[0] for p in r], [p[1] for p in r], color="#bbbbbb", alpha=.8, lw=0)
    cnt = {}
    for r in D.get("roads") or []:
        hw = r.get("highway") or "service"
        cnt[hw] = cnt.get(hw, 0) + 1
        for l in r.get("lines") or []:
            ax.plot([p[0] for p in l], [p[1] for p in l], "-",
                    color=COLOR.get(hw, "#333"), lw=1.6 if hw != "footway" else 0.9,
                    label=hw)
    for w in D.get("waterPolygons") or []:
        for r in w.get("rings") or []:
            ax.fill([p[0] for p in r], [p[1] for p in r], color="#4a86a8", alpha=.75, lw=0)
    for g in D.get("gates") or []:
        ax.plot([g["x"]], [g["z"]], "r^", ms=9)
        ax.annotate(g.get("name", ""), (g["x"], g["z"]), fontsize=9, color="red")
    ax.set_aspect("equal")
    ax.grid(alpha=.25)
    ax.set_title("north roads by type  " + json.dumps(cnt, ensure_ascii=False), fontsize=10)
    fig.tight_layout()
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, "roads_by_type.png")
    fig.savefig(p)
    print("saved", p, cnt)


if __name__ == "__main__":
    main()
