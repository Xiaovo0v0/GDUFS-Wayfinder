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
items.append((os.path.join(VID, "cards", "title.png"), 4.5))
for seg in ("seg_main", "seg_north", "seg_en"):
    timing = json.load(open(os.path.join(VID, seg, "timing.json"), encoding="utf-8"))
    for f in timing:
        items.append((os.path.join(VID, seg, "frames", f["file"]), f["dur"]))
items.append((os.path.join(VID, "cards", "end.png"), 3.5))

if os.path.isdir(NORM):
    shutil.rmtree(NORM)
os.makedirs(NORM, exist_ok=True)

lines = []  # 保留变量以免影响其它引用
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
    items[i] = (dst, dur)

# 用固定帧率铺帧：每张按它的时长重复 N 次，比 concat 的 duration 可靠得多
# （concat 的最后一个 duration 会被 ffmpeg 忽略，导致片尾要么丢要么重复）
FPS = 25
seqdir = os.path.join(VID, "seq")
if os.path.isdir(seqdir):
    shutil.rmtree(seqdir)
os.makedirs(seqdir, exist_ok=True)

k = 0
for src, dur in items:
    n = max(1, int(round(dur * FPS)))
    for _ in range(n):
        k += 1
        dstf = os.path.join(seqdir, "%05d.jpg" % k)
        try:
            os.link(src, dstf)          # 同盘硬链接，不占空间
        except OSError:
            shutil.copyfile(src, dstf)

total = k / float(FPS)
print("片段 %d 个，铺成 %d 帧 @%dfps，时长 %.1f s" % (len(items), k, FPS, total))

cmd = [
    FF, "-y", "-framerate", str(FPS), "-i", os.path.join(seqdir, "%05d.jpg"),
    "-vf", "format=yuv420p", "-r", "30",
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
