# -*- coding: utf-8 -*-
"""生成品牌物料：logo（PNG + SVG）、A3 海报、推文文案。

用法：python tools/make_brand.py
输出：deliverables/logo.png、logo.svg、海报.png、推文文案.md
"""
import os

from PIL import Image, ImageDraw, ImageFont

REPO = r"C:\Users\86134\Desktop\gdufs"
OUT = os.path.join(REPO, "deliverables")
os.makedirs(OUT, exist_ok=True)

BLUE = (0, 70, 148)
BLUE_D = (6, 61, 124)
BLUE_L = (232, 240, 250)
ORANGE = (232, 131, 58)
RED = (230, 0, 19)
INK = (26, 36, 48)
MUTED = (95, 110, 125)
WHITE = (255, 255, 255)

F_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
F_REG = "C:/Windows/Fonts/msyh.ttc"


def font(size, bold=False):
    return ImageFont.truetype(F_BOLD if bold else F_REG, size)


# ---------------- logo ----------------
S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

d.ellipse([8, 8, S - 8, S - 8], fill=BLUE)

# 路径：从左下角向上，再折向右，终点是一只定位针
def sc(p):
    return (int(p[0] * S / 512), int(p[1] * S / 512))


path = [sc((128, 392)), sc((128, 268)), sc((258, 268)), sc((258, 176))]
w = 34 * S // 512
d.line(path, fill=WHITE, width=w, joint="curve")
for p in path[:3]:
    r = w // 2
    d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=WHITE)

# 起点：橙色圆点
sp = sc((128, 392))
r0 = 26 * S // 512
d.ellipse([sp[0] - r0, sp[1] - r0, sp[0] + r0, sp[1] + r0], fill=ORANGE)

# 终点：定位针（针尖在下，露出圆头之外）
tip = sc((258, 272))
head = sc((258, 172))
rh = 62 * S // 512
d.polygon([(tip[0], tip[1]), (head[0] - rh * 0.72, head[1] + rh * 0.55),
           (head[0] + rh * 0.72, head[1] + rh * 0.55)], fill=WHITE)
d.ellipse([head[0] - rh, head[1] - rh, head[0] + rh, head[1] + rh], fill=WHITE)
ri = 24 * S // 512
d.ellipse([head[0] - ri, head[1] - ri, head[0] + ri, head[1] + ri], fill=BLUE)

img.save(os.path.join(OUT, "logo.png"))
print("logo.png", img.size)

# ---------------- logo.svg ----------------
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <title>尚行 · GDUFS Wayfinder</title>
  <circle cx="256" cy="256" r="250" fill="#004694"/>
  <polyline points="128,392 128,268 258,268 258,176"
            fill="none" stroke="#ffffff" stroke-width="34"
            stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="128" cy="392" r="26" fill="#E8833A"/>
  <path d="M258 210 L258 212 L213.4 193.1 A62 62 0 1 1 302.6 193.1 Z" fill="#ffffff"/>
  <circle cx="258" cy="168" r="62" fill="#ffffff"/>
  <circle cx="258" cy="168" r="24" fill="#004694"/>
</svg>
'''
open(os.path.join(OUT, "logo.svg"), "w", encoding="utf-8").write(svg)
print("logo.svg ok")

# ---------------- 海报（A3，150 dpi） ----------------
PW, PH = 1754, 2481
poster = Image.new("RGB", (PW, PH), WHITE)
pd = ImageDraw.Draw(poster)

# 顶部蓝带
pd.rectangle([0, 0, PW, 560], fill=BLUE)

# logo
lg = img.resize((150, 150), Image.LANCZOS)
poster.paste(lg, (92, 92), lg)

pd.text((270, 108), "尚行", font=font(76, True), fill=WHITE)
pd.text((272, 196), "GDUFS Wayfinder", font=font(30), fill=(190, 214, 240))
pd.text((92, 300), "广外校园导航与办事指南", font=font(56, True), fill=WHITE)
pd.text((94, 386), "3D 校园地图 × Dify 智能体　·　南校 / 北校双校区　·　中英双语",
        font=font(26), fill=(206, 224, 244))

# 主标题
pd.text((92, 640), "一句话，从「我要办什么」", font=font(62, True), fill=INK)
pd.text((92, 724), "到「我到、我办成」", font=font(62, True), fill=BLUE)

pd.text((94, 830), "校园地图知道楼在哪，却不知道哪间办公室办什么；办事指南知道流程，",
        font=font(28), fill=MUTED)
pd.text((94, 876), "却说不清从哪个门进、上几层。我们把这两件事合成了一个入口。",
        font=font(28), fill=MUTED)

# 主图
shot = os.path.join(REPO, "artifacts", "3d", "v23_ui_light.png")
if os.path.exists(shot):
    sh = Image.open(shot).convert("RGB")
    tw = 1240
    th = int(sh.height * tw / sh.width)
    sh = sh.resize((tw, th), Image.LANCZOS)
    y = 950
    x0 = (PW - tw) // 2
    pd.rounded_rectangle([x0 - 3, y - 3, x0 + tw + 3, y + th + 3], radius=10, fill=(214, 224, 236))
    poster.paste(sh, (x0, y))

# 三条能力
cards = [
    ("导航", "自然语言说「从文采园怎么去图书馆」，直接画线 + 第一人称漫游"),
    ("办事", "40 条事项给到部门 · 地点 · 时段 · 材料 · 电话，一键导航到楼栋"),
    ("双语", "中文提问中文答、英文提问英文答，地名带英文注解"),
]
cy = 1700
for i, (t1, t2) in enumerate(cards):
    x = 92 + i * 528
    pd.rounded_rectangle([x, cy, x + 492, cy + 230], radius=18, fill=BLUE_L)
    pd.rectangle([x, cy, x + 8, cy + 230], fill=BLUE)
    pd.text((x + 36, cy + 30), t1, font=font(42, True), fill=BLUE)
    # 自动换行
    words = t2
    line = ""
    yy = cy + 96
    for ch in words:
        if pd.textlength(line + ch, font=font(24)) > 420:
            pd.text((x + 36, yy), line, font=font(24), fill=INK)
            line = ch
            yy += 38
        else:
            line += ch
    pd.text((x + 36, yy), line, font=font(24), fill=INK)

# 数字条
nums = [("93", "栋建筑"), ("220", "节点路网"), ("40", "条办事事项"), ("101", "条知识库语料")]
ny = 2000
pd.line([92, ny - 30, PW - 92, ny - 30], fill=(220, 228, 238), width=2)
for i, (n, label) in enumerate(nums):
    x = 92 + i * 400
    pd.text((x, ny), n, font=font(64, True), fill=ORANGE)
    pd.text((x, ny + 84), label, font=font(26), fill=MUTED)

# 页脚
pd.rectangle([0, PH - 150, PW, PH], fill=BLUE_D)
pd.text((92, PH - 112), "尚行 · GDUFS Wayfinder　|　广东外语外贸大学第二届 AI 应用创新大赛",
        font=font(28, True), fill=WHITE)
pd.text((92, PH - 66), "作品形态：自定义 3D 前端 + Dify Chatflow（路由 + 导航/办事/百科 三专家 + 4 Skill + 2 知识库）",
        font=font(22), fill=(190, 214, 240))

poster.save(os.path.join(OUT, "海报.png"))
print("海报.png", poster.size)
