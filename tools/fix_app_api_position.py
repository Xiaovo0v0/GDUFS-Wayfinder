import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

start_marker = '      // ============================================================\n  // 12. 对外接口（供 AI 面板调用）'
end_marker = '  setStatus("请选择起点和终点（可直接点击画面中的建筑）。");\n      return;'

i = s.find(start_marker)
if i < 0:
    raise SystemExit('start marker not found')
j = s.find(end_marker, i)
if j < 0:
    raise SystemExit('end marker not found')

block = s[i:j]  # 不含末尾 setStatus 行
# 去掉缩进错位：把块整体从 6 空格缩进恢复为 2 空格
fixed_lines = []
for line in block.split('\n'):
    if line.startswith('  '):
        fixed_lines.append(line[4:] if line.startswith('      ') else line)
    else:
        fixed_lines.append(line)
block2 = '\n'.join(fixed_lines)

# 1) 复原 route() 的开头
s = s[:i] + '      ' + s[j:]

# 2) 把块插到最后一次 setStatus 之前
tail = '  setStatus("请选择起点和终点（可直接点击画面中的建筑）。");\n  animate();'
k = s.rfind(tail)
if k < 0:
    raise SystemExit('tail not found')
s = s[:k] + block2.rstrip() + '\n\n' + s[k:]

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('fixed; len', len(s))
print('route head:', s[s.find('function route()'):s.find('function route()') + 160].replace('\n', '\\n'))
