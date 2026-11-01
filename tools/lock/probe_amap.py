# -*- coding: utf-8 -*-
"""探测高德 web 端 POI 接口（公开页面自己用的那个），看能否免 key 取到楼名。"""
import json
import urllib.parse
import urllib.request

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Referer": "https://www.amap.com/",
}

NORTH = "113.2810|23.1995|113.2905|23.2090"   # lon|latt|lon|latt of a bbox (amap geoobj)
KW = urllib.parse.quote("教学楼")

URLS = [
    ("poiInfo kw", "https://www.amap.com/service/poiInfo?query_type=TQUERY&pagesize=25&pagenum=1"
                   "&qii=true&cluster_state=5&need_utd=true&utd_sceneid=1000&div=PC1000"
                   "&addr_poi_merge=true&is_classify=true&zoom=17&city=440100"
                   "&geoobj=%s&keywords=%s" % (NORTH, KW)),
    ("poiInfo empty", "https://www.amap.com/service/poiInfo?query_type=TQUERY&pagesize=25&pagenum=1"
                      "&qii=true&cluster_state=5&need_utd=true&utd_sceneid=1000&div=PC1000"
                      "&addr_poi_merge=true&is_classify=true&zoom=17&city=440100"
                      "&geoobj=%s&keywords=" % NORTH),
    ("detail poi", "https://www.amap.com/detail/get/detail?id=B00140FH1H"),
]


def main():
    for tag, url in URLS:
        req = urllib.request.Request(url, headers=UA)
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                raw = r.read()
                print("=== %s  %s  %d bytes  ct=%s" % (tag, r.status, len(raw), r.headers.get("Content-Type")))
                try:
                    d = json.loads(raw.decode("utf-8", "replace"))
                    txt = json.dumps(d, ensure_ascii=False)
                except Exception:
                    txt = raw.decode("utf-8", "replace")
                print(txt[:900])
        except Exception as e:
            print("=== %s ERR %s %s" % (tag, type(e).__name__, e))


if __name__ == "__main__":
    main()
