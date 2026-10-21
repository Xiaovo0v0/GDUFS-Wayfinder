# -*- coding: utf-8 -*-
"""生成演示视频的片头 / 片尾卡（1440×810，与录屏同尺寸）。

用法：python tools/make_video_cards.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

REPO = r"C:\Users\86134\Desktop\gdufs"
OUT = os.path.join(REPO, "artifacts", "video", "cards")
os.makedirs(OUT, exist_ok=True)

W, H = 1440, 810
BLUE = (0, 70, 148)
BLUE_D = (6, 61, 124)
ORANGE = (232, 131, 58)
WHITE = (255, 255, 255)
F_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
F_REG = "C:/Windows/Fonts/msyh.ttc"


def font(size, bold=False):
    return ImageFont.truetype(F_BOLD if bold else F_REG, size)


def centered(d, y, text, f, fill):
    tw = d.textlength(text, font=f)
    d.text(((W - tw) / 2, y), text, font=f, fill=fill)


# ---------- 片头 ----------
img = Image.new("RGB", (W, H), BLUE)
d = ImageDraw.Draw(img)

# 细网格
for x in range(0, W, 60):
    d.line([x, 0, x, H], fill=(8, 62, 118), width=1)
for y in range(0, H, 60):
    d.line([0, y, W, y], fill=(8, 62, 118), width=1)

logo = Image.open(os.path.join(REPO, "deliverables", "logo.png")).convert("RGBA")
logo = logo.resize((150, 150), Image.LANCZOS)
img.paste(logo, ((W - 150) // 2, 168), logo)

centered(d, 350, "尚行", font(78, True), WHITE)
centered(d, 452, "GDUFS Wayfinder", font(30), (170, 200, 232))
centered(d, 516, "广外校园导航与办事指南", font(40, True), WHITE)
centered(d, 588, "校园地图 × 智能体　·　南校 / 北校　·　中英双语", font(22), (176, 202, 230))

d.line([(W - 380) / 2, 660, (W + 380) / 2, 660], fill=(60, 110, 170), width=2)
centered(d, 686, "广东外语外贸大学第二届 AI 应用创新大赛", font(20), (150, 182, 218))

img.save(os.path.join(OUT, "title.png"))

# ---------- 片尾 ----------
img2 = Image.new("RGB", (W, H), (246, 249, 252))
d2 = ImageDraw.Draw(img2)
d2.rectangle([0, 0, W, 12], fill=BLUE)

logo2 = logo.resize((108, 108), Image.LANCZOS)
img2.paste(logo2, (96, 96), logo2)
d2.text((224, 104), "尚行 · GDUFS Wayfinder", font=font(38, True), fill=BLUE_D)
d2.text((226, 158), "从「我要办什么」，到「我到、我办成」", font=font(22), fill=(95, 110, 125))

nums = [("93", "栋建筑"), ("220", "节点路网"), ("40", "条办事事项"), ("101", "条知识库语料")]
for i, (n, label) in enumerate(nums):
    x = 96 + i * 330
    d2.text((x, 290), n, font=font(72, True), fill=ORANGE)
    d2.text((x, 386), label, font=font(24), fill=(95, 110, 125))

d2.line([96, 470, W - 96, 470], fill=(214, 224, 236), width=2)
d2.text((96, 500), "技术架构", font=font(26, True), fill=BLUE_D)
lines = [
    "① 多智能体协同：意图路由 + 导航 / 办事 / 百科 三个专家分支",
    "② 多 Skill 集成：route-calc · place-lookup · office-hours · materials-check",
    "③ 知识库 / RAG：办事指南 40 条 + 校园百科 61 条，混合检索 + 重排",
]
yy = 548
for ln in lines:
    d2.text((96, yy), ln, font=font(23), fill=(26, 36, 48))
    yy += 48

d2.rectangle([0, H - 76, W, H], fill=BLUE_D)
d2.text((96, H - 58), "Dify 1.17.1　|　DeepSeek-V4-Flash-0731　|　bge-m3 + bge-reranker-v2-m3",
        font=font(20), fill=(180, 205, 235))

img2.save(os.path.join(OUT, "end.png"))
print("cards ok", os.listdir(OUT))
