# -*- coding: utf-8 -*-
"""把北校配准结果写回 north-data.js 的 meta（只是一次性的数据补丁，可重复执行）。"""
import io
import json
import sys

P = "gdufs-3d/north-data.js"
OLD = '"origin_wgs84":null,'
NEW = (
    '"origin_wgs84":{"lat":23.20385672,"lon":113.28631562},'
    '"georef":{'
    '"method":"OSM 路网 ICP 纯平移拟合（旋转/尺度锁死，与 geo.js 的平移投影一致）",'
    '"control":"6565 个 OSM 道路采样点 + 9 栋同名建筑质心",'
    '"residual_median_m":39.1,'
    '"datum":"WGS84",'
    '"imagery":"ArcGIS World Imagery (z18)",'
    '"date":"2026-11-01",'
    '"note":"平面图是示意图：校园整体锁定到 ±40 m，单栋楼 30~80 m 的散布来自底图概括，不是配准误差。复核脚本 tools/lock/register_icp.py + check_fit.py，出图 artifacts/lock/north_final.png。"'
    "},"
)


def main():
    s = io.open(P, encoding="utf-8").read()
    if NEW in s:
        print("already applied")
        return 0
    n = s.count(OLD)
    if n != 1:
        print("unexpected matches for %r: %d" % (OLD, n))
        return 1
    s = s.replace(OLD, NEW)
    io.open(P, "w", encoding="utf-8", newline="").write(s)
    # 校验：整份文件仍是合法 JSON
    txt = io.open(P, encoding="utf-8").read()
    body = txt.split("=", 1)[1].strip().rstrip(";")
    d = json.loads(body)
    print("ok origin=%s georef=%s" % (d["meta"]["origin_wgs84"], d["meta"]["georef"]["method"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
