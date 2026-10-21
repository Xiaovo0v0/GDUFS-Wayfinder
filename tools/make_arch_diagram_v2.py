# -*- coding: utf-8 -*-
"""生成「尚行 · 广外校园向导」技术架构图（初赛方案用）。

三个技术加分项在图上用 ①②③ 标出，正文可直接引用编号：
  ① 多智能体协同（路由 + 三个专家分支）
  ② 多 Skill 集成与组合调用（4 个独立技能）
  ③ 知识库 / RAG 接入（双库 + 重排）

用法：python tools/make_arch_diagram_v2.py
输出：deliverables/架构图.png
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

OUT = r"C:\Users\86134\Desktop\gdufs\deliverables"
os.makedirs(OUT, exist_ok=True)

W, H = 1800, 1340
BG = (255, 255, 255)
INK = (26, 36, 48)
MUTED = (95, 110, 125)
LINE = (170, 185, 200)

BLUE_D = (0, 70, 148)
BLUE = (39, 80, 154)
BLUE_L = (232, 240, 250)
RED = (230, 0, 19)
RED_L = (253, 236, 238)
GREEN = (28, 125, 69)
GREEN_L = (232, 245, 236)
AMBER = (200, 120, 50)
AMBER_L = (255, 246, 236)
PURPLE = (110, 85, 180)
PURPLE_L = (246, 240, 255)
GRAY_L = (240, 244, 248)

F_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
F_REG = "C:/Windows/Fonts/msyh.ttc"


def font(size, bold=False):
    return ImageFont.truetype(F_BOLD if bold else F_REG, size)


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)


def band(x0, y0, x1, y1, title, color, fill):
    d.rounded_rectangle([x0, y0, x1, y1], radius=18, fill=fill, outline=color, width=3)
    d.rounded_rectangle([x0, y0, x0 + 128, y1], radius=18, fill=color)
    d.rectangle([x0 + 110, y0, x0 + 128, y1], fill=color)
    # 竖排标签
    label = title
    fs = 24
    total = len(label) * (fs + 4)
    ty = y0 + (y1 - y0 - total) / 2
    for ch in label:
        tw = d.textlength(ch, font=font(fs, True))
        d.text((x0 + 64 - tw / 2, ty), ch, font=font(fs, True), fill=(255, 255, 255))
        ty += fs + 4


def chip(x0, y0, x1, y1, text, color, fill, size=18, bold=False):
    d.rounded_rectangle([x0, y0, x1, y1], radius=12, fill=fill, outline=color, width=2)
    tw = d.textlength(text, font=font(size, bold))
    d.text((x0 + (x1 - x0 - tw) / 2, y0 + (y1 - y0 - size * 1.35) / 2), text,
           font=font(size, bold), fill=INK if not bold else color)


def badge(cx, cy, num, color):
    r = 17
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color, outline=(255, 255, 255), width=3)
    t = num
    tw = d.textlength(t, font=font(20, True))
    d.text((cx - tw / 2, cy - 14), t, font=font(20, True), fill=(255, 255, 255))


def arrow(x0, y0, x1, y1, color=LINE, width=3):
    d.line([x0, y0, x1, y1], fill=color, width=width)
    ang = math.atan2(y1 - y0, x1 - x0)
    L = 16
    for s in (0.45, -0.45):
        d.line([x1, y1, x1 - L * math.cos(ang - s), y1 - L * math.sin(ang - s)], fill=color, width=width)


# ---------- 标题 ----------
d.text((60, 34), "尚行 · GDUFS Wayfinder　技术架构", font=font(38, True), fill=BLUE_D)
d.text((62, 88), "3D 校园地图（眼睛与腿） + Dify 智能体（大脑），用「动作契约」把两端解耦",
       font=font(20), fill=MUTED)
d.line([60, 128, 1740, 128], fill=(220, 228, 238), width=2)

# ---------- ① 用户层 ----------
y = 150
chip(60, y, 420, y + 62, "评委 · 浏览器（内网 http）", BLUE, BLUE_L)
chip(450, y, 810, y + 62, "手机 / 平板（同一套页面）", BLUE, BLUE_L)
chip(840, y, 1200, y + 62, "Dify WebApp（智能体本体）", BLUE, BLUE_L)
d.text((1240, y + 20), "无需安装任何客户端", font=font(18), fill=MUTED)

# ---------- ② 交互层 ----------
y2 = 250
band(60, y2, 1740, y2 + 150, "交互层", GREEN, GREEN_L)
chip(210, y2 + 20, 560, y2 + 62, "Three.js 3D 校园地图", GREEN,
     (255, 255, 255) if False else GREEN_L, bold=True)
chip(580, y2 + 20, 900, y2 + 62, "第一人称漫游 · 1.4 m/s", GREEN, GREEN_L)
chip(920, y2 + 20, 1240, y2 + 62, "路线绘制 · 100 m 距离牌", GREEN, GREEN_L)
chip(1260, y2 + 20, 1600, y2 + 62, "办事卡片 · 四按钮联动", GREEN, GREEN_L)
d.text((212, y2 + 82), "南校区 51 栋 LOD2（Blender 导出 GLB）　·　北校区 42 栋（官方平面图矢量化）　·　"
                       "路网 220 节点 / 239 边　·　断网自动降级本地规则",
       font=font(18), fill=MUTED)

# ---------- ③ 智能层 ----------
y3 = 430
band(60, y3, 1740, y3 + 330, "智能层", AMBER, AMBER_L)
d.text((212, y3 + 16), "Dify Chatflow · 尚行 广外校园向导", font=font(22, True), fill=AMBER)

chip(212, y3 + 54, 500, y3 + 100, "意图路由（分类器）", AMBER, (255, 255, 255), bold=True)
badge(486, y3 + 60, "①", RED)
d.text((520, y3 + 66), "导航 / 办事 / 百科 / 闲聊", font=font(18), fill=MUTED)

branches = [
    ("导航专家", ["算路技能（内嵌 Dijkstra）", "输出 distance / minutes / points"], 212),
    ("办事专家", ["检索办事指南库 TopK6", "输出部门·地点·时段·材料"], 600),
    ("百科专家", ["检索校园百科库 TopK6", "输出楼栋档案与常识"], 988),
    ("闲聊", ["轻量对话", "引导到导航或办事"], 1376),
]
for name, lines, bx in branches:
    d.rounded_rectangle([bx, y3 + 118, bx + 356, y3 + 268], radius=14,
                        fill=(255, 255, 255), outline=AMBER, width=2)
    d.text((bx + 18, y3 + 130), name, font=font(21, True), fill=AMBER)
    yy = y3 + 170
    for ln in lines:
        d.text((bx + 18, yy), "· " + ln, font=font(17), fill=INK)
        yy += 30

d.rounded_rectangle([212, y3 + 284, 1600, y3 + 322], radius=10, fill=BLUE_D)
d.text((232, y3 + 290), "汇总 → 动作契约 JSON：{intent, from, to, answer, card}　·　"
                        "模型只产出结构，渲染由前端确定性执行",
       font=font(19, True), fill=(255, 255, 255))
badge(1596, y3 + 288, "①", RED)

# ---------- ④ 技能层 ----------
y4 = 800
band(60, y4, 1740, y4 + 130, "技能层", PURPLE, PURPLE_L)
d.text((212, y4 + 12), "4 个独立 Skill 工作流（各自有输入/输出契约，可单独发布为工具）",
       font=font(19, True), fill=PURPLE)
skills = [
    ("route-calc", "算路 820 m 实测"),
    ("place-lookup", "地名 → 坐标"),
    ("office-hours", "现在能办吗"),
    ("materials-check", "材料 / 电话 / 地点"),
]
sx = 212
for name, sub in skills:
    d.rounded_rectangle([sx, y4 + 46, sx + 330, y4 + 108], radius=12,
                        fill=(255, 255, 255), outline=PURPLE, width=2)
    d.text((sx + 16, y4 + 54), name, font=font(19, True), fill=PURPLE)
    d.text((sx + 16, y4 + 80), sub, font=font(16), fill=MUTED)
    sx += 348
badge(sx - 18, y4 + 44, "②", RED)

# ---------- ⑤ 知识层 ----------
y5 = 960
band(60, y5, 1740, y5 + 120, "知识层", BLUE, BLUE_L)
d.rounded_rectangle([212, y5 + 18, 906, y5 + 102], radius=12, fill=(255, 255, 255), outline=BLUE, width=2)
d.text((230, y5 + 26), "广外办事指南", font=font(20, True), fill=BLUE_D)
d.text((230, y5 + 56), "40 条事项 · 12,550 字 · 混合检索 + bge-reranker-v2-m3 重排", font=font(17), fill=INK)
d.rounded_rectangle([926, y5 + 18, 1620, y5 + 102], radius=12, fill=(255, 255, 255), outline=BLUE, width=2)
d.text((944, y5 + 26), "广外校园百科", font=font(20, True), fill=BLUE_D)
d.text((944, y5 + 56), "61 条 · 16,858 字 · 楼栋/场馆/食堂档案 · 同一套检索配置", font=font(17), fill=INK)
badge(1608, y5 + 20, "③", RED)

# ---------- ⑥ 数据层 ----------
y6 = 1110
band(60, y6, 1740, y6 + 110, "数据层", (110, 125, 140), GRAY_L)
srcs = [
    ("11 个院部官网", "办事流程 / 电话 / 地点"),
    ("规划验收合格证", "单栋层数 · 面积"),
    ("OSM + Overture", "南校轮廓 · 路网"),
    ("官方平面图", "北校 42 栋 · 道路 · 水系"),
]
sx = 212
for name, sub in srcs:
    d.rounded_rectangle([sx, y6 + 14, sx + 330, y6 + 96], radius=12, fill=(255, 255, 255),
                        outline=(150, 165, 180), width=2)
    d.text((sx + 16, y6 + 22), name, font=font(19, True), fill=INK)
    d.text((sx + 16, y6 + 54), sub, font=font(16), fill=MUTED)
    sx += 348

# ---------- 箭头 ----------
arrow(900, 212, 900, 248, BLUE)
arrow(900, 400, 900, 428, GREEN)
arrow(900, 760, 900, 798, AMBER)
arrow(900, 930, 900, 958, PURPLE)
arrow(900, 1080, 900, 1108, (150, 165, 180))

# ---------- 图例 ----------
d.text((62, 1256), "①", font=font(22, True), fill=RED)
d.text((88, 1258), "多智能体协同：路由 + 三个专家分支各带独立提示词与工具集", font=font(18), fill=INK)
d.text((760, 1256), "②", font=font(22, True), fill=RED)
d.text((786, 1258), "多 Skill 集成：4 个独立技能 + 组合调用", font=font(18), fill=INK)
d.text((1290, 1256), "③", font=font(22, True), fill=RED)
d.text((1316, 1258), "知识库 / RAG：双库 101 条 + 重排", font=font(18), fill=INK)

out = os.path.join(OUT, "架构图.png")
img.save(out)
print("saved", out, img.size)
