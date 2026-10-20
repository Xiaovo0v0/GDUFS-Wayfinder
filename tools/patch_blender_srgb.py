import io

p = r'C:\Users\86134\Desktop\gdufs\tools\blender_build.py'
s = io.open(p, encoding='utf-8').read()

if 'def srgb(' not in s:
    s = s.replace(
        'def solid_mat(name, rgb, rough=0.9):',
        'def srgb(c):\n    return (c / 255.0) ** 2.2\n\n\ndef solid_mat(name, rgb, rough=0.9):'
    )

old = "b.inputs[\"Base Color\"].default_value = (rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1)"
new = "b.inputs[\"Base Color\"].default_value = (srgb(rgb[0]), srgb(rgb[1]), srgb(rgb[2]), 1)"
if old not in s:
    print("MISS base color line")
s = s.replace(old, new)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok', 'def srgb(' in s, '(srgb(rgb[0])' in s)
