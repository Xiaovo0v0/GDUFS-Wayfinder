import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\navigator-ui.js'
s = io.open(p, encoding='utf-8').read()

old = """  function findPlaceInText(text) {
    if (!nav || !nav.placeLabels) return [];
    var t = norm(text);"""
new = """  var TEXT_ALIAS = [
    ["一饭", "文采园"], ["一食堂", "文采园"],
    ["二饭", "博雅园"], ["二食堂", "博雅园"],
    ["三饭", "风采园"], ["三食堂", "风采园"],
    ["校医院", "门诊部"], ["大礼堂", "大会堂"], ["羽球馆", "体育馆"], ["主校门", "正门"]
  ];

  function findPlaceInText(text) {
    if (!nav || !nav.placeLabels) return [];
    var src = text || "";
    TEXT_ALIAS.forEach(function (p) { if (src.indexOf(p[0]) >= 0) { src += " " + p[1]; } });
    var t = norm(src);"""

if old not in s:
    raise SystemExit('MISS findPlaceInText')
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('navigator-ui patched', len(s))
