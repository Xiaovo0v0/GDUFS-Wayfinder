# -*- coding: utf-8 -*-
"""把初赛设计方案 Markdown 转成 DOCX（含架构图、表格、中文排版）。"""
import os
import re

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

SRC = r"C:\Users\86134\Desktop\gdufs\deliverables\初赛设计方案.md"
OUT = r"C:\Users\86134\Desktop\gdufs\deliverables\广外校园向导-初赛设计方案.docx"
BASE = os.path.dirname(SRC)

doc = Document()

# 页面
sec = doc.sections[0]
sec.top_margin = Cm(2.4)
sec.bottom_margin = Cm(2.2)
sec.left_margin = Cm(2.6)
sec.right_margin = Cm(2.6)

# 正文样式
normal = doc.styles["Normal"]
normal.font.name = "宋体"
normal.font.size = Pt(11)
normal.element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
normal.paragraph_format.line_spacing = 1.45
normal.paragraph_format.space_after = Pt(4)


def set_run(run, size=None, bold=None, color=None, eastasia="宋体", ascii_font="Times New Roman"):
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if color:
        run.font.color.rgb = RGBColor(*color)
    run.font.name = ascii_font
    run._element.rPr.rFonts.set(qn("w:eastAsia"), eastasia)


def add_rich(p, text, size=11, bold=False, eastasia="宋体"):
    """处理 **加粗** 与 `代码`"""
    parts = re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", text)
    for part in parts:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            r = p.add_run(part[2:-2])
            set_run(r, size=size, bold=True, eastasia=eastasia)
        elif part.startswith("`") and part.endswith("`"):
            r = p.add_run(part[1:-1])
            set_run(r, size=size - 0.5, bold=bold, eastasia="Consolas", ascii_font="Consolas")
        else:
            r = p.add_run(part)
            set_run(r, size=size, bold=bold, eastasia=eastasia)


lines = open(SRC, encoding="utf-8").read().split("\n")
i = 0
n = len(lines)
first_h1 = True

while i < n:
    line = lines[i].rstrip()
    if not line.strip():
        i += 1
        continue

    if line.startswith("# ") and first_h1:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(2)
        add_rich(p, line[2:].strip(), size=22, bold=True, eastasia="黑体")
        first_h1 = False
        i += 1
        continue

    if line.startswith("## "):
        txt = line[3:].strip()
        if txt.startswith("——"):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(10)
            add_rich(p, txt, size=13, bold=True, eastasia="楷体")
        else:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(5)
            add_rich(p, txt, size=14, bold=True, eastasia="黑体")
        i += 1
        continue

    if line.startswith("### "):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(6)
        add_rich(p, line[4:].strip(), size=12, bold=True, eastasia="黑体")
        i += 1
        continue

    if line.startswith("!["):
        m = re.match(r"!\[[^\]]*\]\(([^)]+)\)", line)
        if m:
            path = os.path.join(BASE, m.group(1))
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.add_run().add_picture(path, width=Cm(15.4))
            cap = doc.add_paragraph()
            cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = cap.add_run("图 1　系统技术架构")
            set_run(r, size=9, color=(0x66, 0x66, 0x66), eastasia="楷体")
            cap.paragraph_format.space_after = Pt(10)
        i += 1
        continue

    if line.startswith("|"):
        rows = []
        while i < n and lines[i].strip().startswith("|"):
            raw = lines[i].strip()
            if not re.match(r"^\|[\s:\-|]+\|$", raw):
                cells = [c.strip() for c in raw.strip("|").split("|")]
                rows.append(cells)
            i += 1
        if rows:
            cols = max(len(r) for r in rows)
            table = doc.add_table(rows=len(rows), cols=cols)
            table.style = "Table Grid"
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            for ri, row in enumerate(rows):
                for ci in range(cols):
                    cell = table.cell(ri, ci)
                    cell.text = ""
                    p = cell.paragraphs[0]
                    p.paragraph_format.space_after = Pt(2)
                    txt = row[ci] if ci < len(row) else ""
                    add_rich(p, txt, size=9.5, bold=(ri == 0),
                             eastasia="黑体" if ri == 0 else "宋体")
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
        continue

    if line.startswith("> "):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.6)
        r = p.add_run(line[2:].strip())
        set_run(r, size=9.5, color=(0x55, 0x55, 0x55), eastasia="楷体")
        i += 1
        continue

    if line.startswith("- "):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.75)
        p.paragraph_format.first_line_indent = Cm(-0.4)
        add_rich(p, "· " + line[2:].strip())
        i += 1
        continue

    m = re.match(r"^(\d+)\.\s+(.*)$", line)
    if m:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.75)
        p.paragraph_format.first_line_indent = Cm(-0.75)
        add_rich(p, m.group(1) + ". " + m.group(2).strip())
        i += 1
        continue

    if line.startswith("---"):
        i += 1
        continue

    # 普通段落（合并连续行）
    buf = [line]
    i += 1
    while i < n and lines[i].strip() and not re.match(r"^(#|\||>|- |\d+\.|!\[|---)", lines[i].strip()):
        buf.append(lines[i].strip())
        i += 1
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    add_rich(p, "".join(buf))

doc.save(OUT)
print("saved", OUT, os.path.getsize(OUT), "bytes")
