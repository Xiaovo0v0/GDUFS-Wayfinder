import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

old = '''    "主校门": "正门", "大门": "正门", "北门": "正门"
  };'''
new = '''    "主校门": "正门", "大门": "正门", "北门": "正门",
    "教a": "教学楼A栋", "教b": "教学楼B栋", "教c": "教学楼C栋", "教d": "教学楼D栋",
    "教e": "教学楼E栋", "教f": "教学楼F栋", "教g": "教学楼G栋"
  };'''
if old not in s:
    raise SystemExit('MISS alias tail')
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('added 教X aliases')
