# -*- coding: utf-8 -*-
"""按官方模板填写初赛设计方案（保留模板版式，只填内容）。

用法：python tools/fill_design_docx.py
输入：deliverables/官方模板-初赛设计方案.docx（官方原件）
输出：deliverables/广外校园向导-初赛设计方案.docx
"""
import json
import os

import docx
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor

REPO = r"C:\Users\86134\Desktop\gdufs"
TPL = os.path.join(REPO, "deliverables", "官方模板-初赛设计方案.docx")
OUT = os.path.join(REPO, "deliverables", "广外校园向导-初赛设计方案.docx")
ARCH = os.path.join(REPO, "deliverables", "架构图.png")
SHOT1 = os.path.join(REPO, "artifacts", "3d", "v23_ui_light.png")
SHOT2 = os.path.join(REPO, "artifacts", "3d", "v27_card2.png")

INK = RGBColor(0x1A, 0x24, 0x30)

# ---------------- 正文内容 ----------------
TEAM = "＿＿＿＿＿＿"
THEME = "生活服务（校园导航与办事指南）"
SECTION = "生活服务"
WORK = "尚行 · GDUFS Wayfinder（广外校园向导）"
USE = "导航 + 办事指南"
WORK_SHORT = "尚行 · GDUFS Wayfinder"

FORM = "☑ AI Agent 智能体开发　　☑ Skill 技能开发　　☑ 数字专家设计"

USERS = ("新生与家长、在校生、教师、访客与考生、国际师生、后勤与外来服务人员。"
         "其中新生与家长对「报到季找路」最敏感，在校生对「办事少跑一趟」最敏感，"
         "国际师生对双语与跨语言能力有真实需求。")

SCENES = ("① 报到季：从正门到宿舍、到报到点；② 考试周：找考场到「实验楼C区」这一级；"
          "③ 日常办事：成绩单、校园卡补办、医保报销、图书借阅、宿舍报修；"
          "④ 访客与考生：入校、找会场；⑤ 留学生首次到校：用英文问路。")

PLATFORM = ("Dify 1.17.1 社区版（学校部署于 172.17.1.46）。对话模型 DeepSeek-V4-Flash-0731，"
            "向量模型 bge-m3，重排模型 bge-reranker-v2-m3。前端为自研 Three.js 静态页面，"
            "通过 Dify Service API 调用智能体。")

PAIN = (
    "高校并不缺地图、指南和通知，缺的是一个能把「我要办什么」翻译成"
    "「去哪、带什么、找谁、多久、现在到哪」的统一索引。具体表现为四个断点：\n"
    "第一，空间信息与流程信息彼此割裂。地图知道楼在哪，却不知道这栋楼里哪间办公室办什么事；"
    "指南知道流程，却说不清这个部门在校园什么位置。\n"
    "第二，粒度停在「楼栋」。一栋楼有多个入口、多个楼层，办事大厅有十几个窗口，"
    "用户到了楼下仍然不知道从哪个门进、上几层、找哪个窗口。\n"
    "第三，两校区割裂。我们统计的 40 条高频事项中，有 27 条涉及白云山校区，"
    "而现有校园地图与导航只覆盖大学城校区，问答与地图自相矛盾。\n"
    "第四，通用大模型不了解广外。直接问「广外图书馆几层」，得到的往往是一本正经的错误答案；"
    "而校园场景容错率极低——把学生指到错误的楼、给出不存在的房间号，比不回答更糟。"
)

FUNC = (
    "M1 3D 校园地图：南校区 51 栋采用 Blender 无头脚本生成的 LOD2 模型（程序化立面、女儿墙、"
    "屋顶设备），北校区 42 栋由学校官方平面图矢量化得到；含 9 个官方校门、水系与近千棵行道树；"
    "支持第一人称漫游（1.4 m/s，人眼高度 1.65 m）。\n"
    "M2 智能导航：用自然语言说出起终点，直接在地图上画出步行路线，标注总距离、耗时与每 100 米路标。\n"
    "M3 办事指南：40 条事项给出部门、地点、时段、材料、电话；卡片支持一键导航到楼栋、一键拨号、"
    "一键复制材料清单、一键跳转官网原文。\n"
    "M4 营业状态：按当前时刻判断「现在能不能办」，并给出今日下班时间或下次开放时间。\n"
    "M5 校区上下文：按所在校区给出对应办理点；若仅另一校区可办，明确提示并可一键切换。\n"
    "M6 本地客户端与双通道：整份作品打包成一个 1.7 MB 的 HTML，双击即用；联网时调用校内智能体，断网时自动降级为本地规则。中英双语，中文提问中文答、英文提问英文答。"
)

INNOV = (
    "1. 动作契约。大模型不直接「说完了事」，而是输出结构化动作 JSON"
    "（intent / from / to / answer / card），画线、飞相机、弹卡片全部由前端确定性代码执行。"
    "这从根本上避免了「AI 说往东走、地图纹丝不动」的割裂，也让同一套智能体可被网页、小程序、"
    "公众号复用。\n"
    "2. 权威数据驱动。建筑层数与面积取自广州市规划和自然资源局「建设工程规划验收合格证」；"
    "北校区 42 栋轮廓由学校官方平面图矢量化（以 400 米跑道标定 0.4178 米/像素）。"
    "每条数据都记录来源与置信度，可追溯、可证伪。\n"
    "3. 双通道降级。作品链接在公网或断网环境下自动切换到本地规则（地名匹配 + 40 条 FAQ），"
    "不会白屏，避免「看起来能用、现场打不开」。\n"
    "4. 落到「最后一米」。不满足于楼栋级，直接给出房间号（如「大学城 · 行政办公楼 224 室」"
    "「白云山 · 行政楼 121 室」），并按校区自动切换。\n"
    "5. 一份投入两处可用。4 个技能按 SKILL.md 规范封装，既能导入 Dify，也符合 WorkBuddy 的上架结构。"
)

TECH = (
    "平台选型：选用 Dify 而非其他平台，理由有三——① 作品形态是「自定义 3D 前端 + 智能体」，"
    "需要 Service API 让前端驱动渲染；② 多智能体协同、多 Skill 集成与 RAG 三项能力可在同一应用内组合；"
    "③ 自部署于校内服务器，发布即生效，不依赖第三方审核周期。\n"
    "系统分六层（见架构图）：数据层 → 知识层 → 技能层 → 智能层 → 交互层 → 用户层，"
    "层与层之间以动作契约解耦。\n"
    "智能层是一条 Chatflow：意图路由把问题分到导航、办事、百科、闲聊四条分支，"
    "每条分支由独立的专家节点处理——导航专家调用算路技能，办事专家检索办事指南库，"
    "百科专家检索校园百科库，最后经变量汇总统一输出动作契约。①\n"
    "技能层沉淀 4 个可独立发布的 Skill：route-calc（算路，内嵌 220 节点 239 边路网跑 Dijkstra）、"
    "place-lookup（地名与别名解析）、office-hours（办公时段判定）、materials-check（材料与办理点），"
    "各有明确的输入输出契约，既可被主应用组合调用，也能单独发布为工具。②\n"
    "知识层为双库：广外办事指南 40 条 12,550 字、广外校园百科 61 条 16,858 字，"
    "均配置混合检索 + bge-reranker-v2-m3 重排，TopK 6。③\n"
    "关键提示词：只许使用检索结果，没有就写「官网未公布」，温度 0.1–0.3，从源头抑制编造。\n"
    "交付形态：以「本地客户端应用」交付——Three.js、GLB 模型、路网、办事数据全部内联进一个 "
    "1.7 MB 的 HTML，双击即开，不依赖 Node / Python / 数据库，也不要求联网；联网时通过 "
    "Service API 调用校内 Dify 智能体，断网时自动降级为本地规则（地名匹配 + 40 条 FAQ），"
    "地图、路线规划、第一人称漫游、办事卡片与中英双语均不受影响。这样才能保证评委在任何"
    "网络环境下都能看到完整作品。"
)

FUTURE = (
    "短期（一个学期）：接入迎新网与「一站式」办事大厅，作为新生报到与高频办事的统一入口；"
    "北校区补齐后可直接服务白云山校区师生。\n"
    "中期：建筑档案、路网拓扑、事项卡片均为结构化数据，可作为学校「校园数字孪生」与"
    "一站式服务大厅的基础素材，后续接入迎新网、微信公众号或校园 APP 的成本很低。\n"
    "长期：广外以外语外贸见长、国际师生比例高，双语与跨语言检索能力可直接复用到校际交流、"
    "留学生服务等场景；技能包可上架开放平台，供其他院校复用。"
)


def set_cell(cell, text, size=10.5, bold=False, align=None):
    cell.text = ""
    p = cell.paragraphs[0]
    if align:
        p.alignment = align
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if i:
            p = cell.add_paragraph()
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
        run = p.add_run(line)
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = INK
        run.font.name = "微软雅黑"
        from docx.oxml.ns import qn
        run._element.rPr.rFonts.set(qn("w:eastAsia"), "微软雅黑")


doc = docx.Document(TPL)
t = doc.tables[0]

# 团队信息：有 deliverables/team.json 就用它，没有则留占位（tools/fill_team.py 负责生成）
TEAM_JSON = os.path.join(REPO, "deliverables", "team.json")
TEAM_INFO = {}
if os.path.exists(TEAM_JSON):
    try:
        with open(TEAM_JSON, encoding="utf-8") as f:
            TEAM_INFO = json.load(f)
        print("读到团队信息：", TEAM_INFO.get("team", ""), "，成员", len(TEAM_INFO.get("members") or []), "人")
    except Exception as e:  # noqa: BLE001
        print("team.json 解析失败，忽略：", e)

FIELDS = ["name", "dept", "sid", "phone", "mail"]

set_cell(t.cell(0, 1), TEAM_INFO.get("team") or TEAM)
set_cell(t.cell(1, 1), THEME)

leader = TEAM_INFO.get("leader") or {}
for i, k in enumerate(FIELDS):
    set_cell(t.cell(3, 1 + i), leader.get(k, ""))

members = TEAM_INFO.get("members") or []
for r in range(5, 9):
    idx = r - 5
    m = members[idx] if idx < len(members) else {}
    for i, k in enumerate(FIELDS):
        set_cell(t.cell(r, 1 + i), m.get(k, ""))

set_cell(t.cell(10, 0), SECTION)
set_cell(t.cell(10, 2), WORK)
set_cell(t.cell(10, 4), USE)

set_cell(t.cell(12, 3), WORK_SHORT)
set_cell(t.cell(14, 3), FORM)
set_cell(t.cell(16, 3), USERS)
set_cell(t.cell(18, 3), SCENES)
set_cell(t.cell(20, 3), PLATFORM)
set_cell(t.cell(22, 3), PAIN)
set_cell(t.cell(24, 3), FUNC)
set_cell(t.cell(26, 3), INNOV)

# 技术方案：先文字，再插图
cell = t.cell(28, 3)
set_cell(cell, TECH)
if os.path.exists(ARCH):
    p = cell.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(ARCH, width=Cm(8.6))
    cap = cell.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = cap.add_run("图 1　技术架构（① 多智能体协同　② 多 Skill 集成　③ 知识库/RAG）")
    r.font.size = Pt(8.5)
    r.font.color.rgb = RGBColor(0x5D, 0x6B, 0x7B)

set_cell(t.cell(30, 3), FUTURE)

# ---------------- 附图（表格之后） ----------------
doc.add_page_break()
h = doc.add_paragraph()
LOGO = os.path.join(REPO, "deliverables", "logo.png")
if os.path.exists(LOGO):
    lp = doc.add_paragraph()
    lp.add_run().add_picture(LOGO, width=Cm(1.6))
hr = h.add_run("附：作品界面实拍")
hr.font.size = Pt(12)
hr.font.bold = True
hr.font.color.rgb = RGBColor(0x00, 0x46, 0x94)

for path, caption in ((SHOT1, "图 2　3D 校园地图主界面（南校区，广外蓝视觉系统）"),
                      (SHOT2, "图 3　办事卡片：校区徽章、营业状态、材料清单与四个行动按钮")):
    if not os.path.exists(path):
        continue
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(path, width=Cm(15.2))
    c = doc.add_paragraph()
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = c.add_run(caption)
    r.font.size = Pt(8.5)
    r.font.color.rgb = RGBColor(0x5D, 0x6B, 0x7B)

doc.save(OUT)

# ---------------- 统计字数 ----------------
import re


def han_count(s):
    return len(re.findall(r"[\u4e00-\u9fff]", s))


parts = [TEAM, THEME, USE, FORM, USERS, SCENES, PLATFORM, PAIN, FUNC, INNOV, TECH, FUTURE, SECTION, WORK]
total = sum(han_count(x) for x in parts)
print("输出", OUT)
print("正文汉字数（不含模板固定文字与图表标题）：", total)
print("含模板标签的整篇估计：约", total + 260, "字")
