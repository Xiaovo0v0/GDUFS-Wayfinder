# -*- coding: utf-8 -*-
"""生成初赛设计方案用的技术架构图（PIL 手绘，无外部依赖）。"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = r"C:\Users\86134\Desktop\gdufs\deliverables"
os.makedirs(OUT, exist_ok=True)

W, H = 1800, 1272
BG = (255, 255, 255)
INK = (28, 38, 50)
MUTED = (95, 110, 125)
LINE = (150, 165, 180)

C_USER = ((232, 242, 255), (70, 120, 190))
C_FE = ((240, 250, 242), (60, 130, 90))
C_DIFY = ((255, 246, 236), (200, 120, 50))
C_KB = ((246, 240, 255), (120, 90, 190))
C_DATA = ((240, 244, 248), (110, 125, 140))
C_DEPLOY = ((255, 240, 244), (185, 80, 110))

F_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
F_REG = "C:/Windows/Fonts/msyh.ttc"


def font(size, bold=False):
    return ImageFont.truetype(F_BOLD if bold else F_REG, size)


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)


def box(x0, y0, x1, y1, title, lines, colors, title_size=26, body_size=20, radius=16):
    fill, stroke = colors
    d.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=stroke, width=3)
    # 标题条
    d.rounded_rectangle([x0, y0, x1, y0 + 52], radius=radius, fill=stroke)
    d.rectangle([x0, y0 + 36, x1, y0 + 52], fill=stroke)
    tw = d.textlength(title, font=font(title_size, True))
    d.text((x0 + (x1 - x0 - tw) / 2, y0 + 11), title, font=font(title_size, True), fill=(255, 255, 255))
    y = y0 + 68
    for ln in lines:
        d.text((x0 + 22, y), ln, font=font(body_size), fill=INK)
        y += 34


def arrow(x0, y0, x1, y1, label="", color=LINE, width=3, label_side="right", fontsize=18):
    d.line([x0, y0, x1, y1], fill=color, width=width)
    # 箭头
    import math
    ang = math.atan2(y1 - y0, x1 - x0)
    L = 14
    for s in (+0.42, -0.42):
        d.line([x1, y1, x1 - L * math.cos(ang - s), y1 - L * math.sin(ang - s)], fill=color, width=width)
    if label:
        tw = d.textlength(label, font=font(fontsize))
        if label_side == "right":
            d.text((x1 + 12, (y0 + y1) / 2 - 12), label, font=font(fontsize), fill=MUTED)
        else:
            d.text(((x0 + x1 - tw) / 2, (y0 + y1) / 2 + 8), label, font=font(fontsize), fill=MUTED)


# ---------------- 标题 ----------------
d.text((60, 34), "广外校园向导 · 技术架构", font=font(40, True), fill=INK)
d.text((62, 88), "3D 校园地图 + Dify 智能体 · 2026 广外第二届 AI 应用创新大赛", font=font(22), fill=MUTED)

# ---------------- 用户层 ----------------
box(60, 140, 1740, 240, "用 户", ["学生 / 新生 / 家长 / 访客 / 教职工 / 评委"], C_USER, title_size=24)
arrow(900, 240, 900, 292, "", C_USER[1])

# ---------------- 前端 + 发布 ----------------
box(60, 296, 1090, 620, "3D 校园前端（Three.js，浏览器本地运行）", [
    "· Blender 导出的 LOD2 模型：51 栋建筑，含立面贴图 / 女儿墙 / 雨棚",
    "· 220 节点 · 239 边道路拓扑，Dijkstra 计算步行路径（含地下隧道）",
    "· 相机飞行 + 路线绘制 + 建筑信息卡（官方来源 / 置信度）",
    "· 1 008 棵行道树、河道水系、6 个官方校门",
    "· 离线兜底：本地地名匹配 + 40 条 FAQ，断网仍可导航",
], C_FE)

box(1130, 296, 1740, 620, "发布形态", [
    "· 单文件 HTML（1.5 MB）：双击即开，可直接上传公网",
    "· Dify WebApp：/chat/xbhUki5mY7mJRfux",
    "· Service API：/v1/chat-messages（自定义前端）",
    "· 降级策略：Dify 不可达 → 本地规则",
], C_DEPLOY)
arrow(1090, 458, 1130, 458, "", C_DEPLOY[1])

# ---------------- 动作契约 ----------------
d.rounded_rectangle([115, 648, 1035, 742], radius=12, fill=(250, 250, 250), outline=(190, 195, 200), width=2)
d.text((135, 660), "动作契约（LLM 只填 JSON，前端只执行）", font=font(21, True), fill=INK)
d.text((135, 698), '{"intent":"navigate|service|wiki|chat","from":"…","to":"…","answer":"…","card":{…}}',
       font=font(19), fill=(70, 90, 110))

# 前端 ↔ 契约
arrow(420, 620, 420, 648, "", C_FE[1])
arrow(420, 742, 420, 770, "query", C_FE[1], label_side="right")

# ---------------- Dify ----------------
box(60, 774, 1740, 930, "Dify Chatflow「广外校园向导」（http://172.17.1.46）", [
    "开始 → 意图识别(LLM) → 知识检索 ×2（办事指南 / 校园百科） → 生成回答(LLM) → 直接回复",
    "模型：DeepSeek-V4-Flash-0731（对话） · bge-m3（向量） · bge-reranker-v2-m3（重排） · 已开启多轮记忆",
], C_DIFY, title_size=25)

# 契约 → Dify
arrow(700, 742, 700, 774, "", C_DIFY[1])

# ---------------- 知识库 ----------------
box(60, 966, 860, 1100, "广外办事指南知识库", [
    "40 条 Q&A · 约 1.26 万字 · 高质量索引 + 混合检索 + 重排",
], C_KB, title_size=23, body_size=19)

box(920, 966, 1740, 1100, "广外校园百科知识库", [
    "61 条 Q&A · 约 1.69 万字 · 建筑 / 场馆 / 食堂 / 校门档案",
], C_KB, title_size=23, body_size=19)

arrow(460, 930, 460, 966, "", C_KB[1])
arrow(1310, 930, 1310, 966, "", C_KB[1])

# ---------------- 数据层 ----------------
box(60, 1118, 1740, 1252, "数据层", [], C_DATA, title_size=22)
d.text((90, 1180),
       "11 个校内部门官网办事流程（jwb / nstu / hqc / bwc / lib / etr / cwc / gwcareer / gwyjs / gwkszx / gwmzb）",
       font=font(18), fill=INK)
d.text((90, 1214),
       "广州市规划验收合格证（单栋层数/面积）　·　官方平面图与校园照片　·　OSM / Overture 开放数据（ODbL）",
       font=font(18), fill=INK)
arrow(460, 1100, 460, 1120, "", C_DATA[1])
arrow(1310, 1100, 1310, 1120, "", C_DATA[1])

# ---------------- 图例 ----------------
d.text((62, 1222), "", font=font(16))

path = os.path.join(OUT, "架构图.png")
img.save(path)
print("wrote", path, img.size)
