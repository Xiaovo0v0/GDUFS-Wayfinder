import io

p = r'C:\Users\86134\Desktop\gdufs\tools\make_design_docx.py'
s = io.open(p, encoding='utf-8').read()

old_bullet = """    if line.startswith("- "):
        p = doc.add_paragraph(style="List Bullet")
        add_rich(p, line[2:].strip())
        i += 1
        continue"""
new_bullet = """    if line.startswith("- "):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.75)
        p.paragraph_format.first_line_indent = Cm(-0.4)
        add_rich(p, "· " + line[2:].strip())
        i += 1
        continue"""
if old_bullet not in s:
    raise SystemExit('MISS bullet')
s = s.replace(old_bullet, new_bullet, 1)

old_num = """    m = re.match(r"^(\\d+)\\.\\s+(.*)$", line)
    if m:
        p = doc.add_paragraph(style="List Number")
        add_rich(p, m.group(2).strip())
        i += 1
        continue"""
new_num = """    m = re.match(r"^(\\d+)\\.\\s+(.*)$", line)
    if m:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.75)
        p.paragraph_format.first_line_indent = Cm(-0.75)
        add_rich(p, m.group(1) + ". " + m.group(2).strip())
        i += 1
        continue"""
if old_num not in s:
    raise SystemExit('MISS number')
s = s.replace(old_num, new_num, 1)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('converter patched')
