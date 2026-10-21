# -*- coding: utf-8 -*-
"""把片头卡 + 两段录屏 + 片尾卡拼成 MP4。

关键点：concat 解复用器要求所有输入尺寸一致，否则只会反复解码第一张图。
所以先统一规整成 1440×810 的 JPG，再交给 ffmpeg。

用法：python tools/encode_video.py
"""
import json
import os
import shutil
import subprocess

from PIL import Image

REPO = r"C:\Users\86134\Desktop\gdufs"
VID = os.path.join(REPO, "artifacts", "video")
NORM = os.path.join(VID, "norm")
FF = os.path.join(REPO, "tools", "bin", "ffmpeg.exe")
OUT = os.path.join(REPO, "deliverables", "演示视频.mp4")
W, H = 1440, 810

items = []
items.append((os.path.join(VID, "cards", "title.png"), 5.0))
for seg in ("seg_main", "seg_en"):
    timing = json.load(open(os.path.join(VID, seg, "timing.json"), encoding="utf-8"))
    for f in timing:
        items.append((os.path.join(VID, seg, "frames", f["file"]), f["dur"]))
items.append((os.path.join(VID, "cards", "end.png"), 4.5))

if os.path.isdir(NORM):
    shutil.rmtree(NORM)
os.makedirs(NORM, exist_ok=True)

lines = []
for i, (src, dur) in enumerate(items):
    im = Image.open(src).convert("RGB")
    if im.size != (W, H):
        # 等比放大到铺满，再居中裁切，避免出现白边
        scale = max(W / im.width, H / im.height)
        im = im.resize((max(W, int(im.width * scale + 0.5)), max(H, int(im.height * scale + 0.5))), Image.LANCZOS)
        left = (im.width - W) // 2
        top = (im.height - H) // 2
        im = im.crop((left, top, left + W, top + H))
    dst = os.path.join(NORM, "%05d.jpg" % (i + 1))
    im.save(dst, quality=93)
    lines.append("file '%s'" % dst.replace("\\", "/"))
    lines.append("duration %.3f" % dur)

lines.append("file '%s'" % os.path.join(NORM, "%05d.jpg" % len(items)).replace("\\", "/"))
listfile = os.path.join(VID, "concat.txt")
open(listfile, "w", encoding="utf-8").write("\n".join(lines) + "\n")

total = sum(d for _, d in items)
print("片段 %d 个，总时长 %.1f s" % (len(items), total))

cmd = [
    FF, "-y", "-f", "concat", "-safe", "0", "-i", listfile,
    "-vf", "fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
    "-movflags", "+faststart",
    OUT,
]
r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
if r.returncode != 0:
    print("ffmpeg 失败：")
    print((r.stderr or "")[-1200:])
    raise SystemExit(1)
print("输出", OUT, "%.1f MB" % (os.path.getsize(OUT) / 1024 / 1024))
