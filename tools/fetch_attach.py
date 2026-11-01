# -*- coding: utf-8 -*-
"""抓取广外附件下载页里的真实文件地址（部分站点先返回一个 JS 跳转页）。

用法：python tools/fetch_attach.py <wrapper.html> [输出文件]
"""
import io
import re
import sys
import urllib.request

src = sys.argv[1]
raw = io.open(src, encoding="utf-8", errors="ignore").read()

cands = re.findall(r"""(?:window\.location(?:\.href)?\s*=\s*|location\.replace\()['"]([^'"]+)['"]""", raw)
if not cands:
    cands = re.findall(r"""(https?://[^'"\s]+\.(?:docx?|xlsx?|pdf|zip|png|jpe?g))""", raw, re.I)
print("找到候选:", cands[:5])

if not cands:
    print("未找到跳转地址，前 600 字：")
    print(raw[:600])
    sys.exit(1)

url = cands[0]
if url.startswith("/"):
    url = "https://dbxb.gdufs.edu.cn" + url

req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://dbxb.gdufs.edu.cn/bslc/hysyd.htm"})
with urllib.request.urlopen(req, timeout=60) as r:
    data = r.read()
    print("状态", r.status, "类型", r.headers.get("Content-Type"), "长度", len(data))
out = sys.argv[2] if len(sys.argv) > 2 else "artifacts/refs/attach.bin"
io.open(out, "wb").write(data)
print("已保存", out, "前 4 字节", data[:4])
