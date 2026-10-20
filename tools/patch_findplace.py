import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
s = io.open(p, encoding='utf-8').read()

start_marker = "  function findPlace(label) {"
end_marker = "  window.__navDebug.findPlace = findPlace;"
i = s.find(start_marker)
j = s.find(end_marker)
if i < 0 or j < 0 or j < i:
    raise SystemExit(f'markers not found i={i} j={j}')

new_fn = '''  // 常见别称 / 口语说法 → 规范地点名
  var PLACE_ALIAS = {
    "一饭": "文采园", "一食堂": "文采园", "第一饭堂": "文采园",
    "二饭": "博雅园", "二食堂": "博雅园", "第二饭堂": "博雅园",
    "三饭": "风采园", "三食堂": "风采园", "第三饭堂": "风采园",
    "校医院": "门诊部", "医院": "门诊部", "医务室": "门诊部",
    "大礼堂": "大会堂", "会堂": "大会堂", "礼堂": "大会堂",
    "羽球馆": "体育馆", "羽毛球馆": "体育馆",
    "主校门": "正门", "大门": "正门", "北门": "正门"
  };

  function expandAlias(n) {
    if (PLACE_ALIAS[n]) { return PLACE_ALIAS[n]; }
    for (var k in PLACE_ALIAS) {
      if (n.indexOf(k) >= 0) { return n.replace(k, PLACE_ALIAS[k]); }
    }
    return n;
  }

  function findPlace(label) {
    if (!label) { return null; }
    var raw = normPlace(label);
    if (!raw) { return null; }
    var n = normPlace(expandAlias(raw));

    // 简写补全：实验楼C → 实验楼C区；教学楼C → 教学楼C栋；C区 → 实验楼C区
    if (/^实验楼[a-e]$/.test(n)) { n += "区"; }
    if (/^教学楼[a-g]$/.test(n)) { n += "栋"; }
    if (/^[a-e]区$/.test(n)) { n = "实验楼" + n; }

    // 只报门牌号：13栋 → 南苑13栋；3栋 → 北苑3栋
    var m = n.match(/^(?:宿舍|学生宿舍|南苑|北苑)?(\\d{1,2})栋?$/);
    if (m) {
      var num = parseInt(m[1], 10);
      if (num >= 7 && num <= 13) { n = "南苑" + num + "栋"; }
      else if (num >= 1 && num <= 6) { n = "北苑" + num + "栋"; }
    }

    var exact = null, part = null;
    for (var i = 0; i < places.length; i++) {
      var pn = normPlace(places[i].label);
      if (pn === n) { exact = places[i]; break; }
      if (!part && (pn.indexOf(n) >= 0 || n.indexOf(pn) >= 0)) { part = places[i]; }
    }
    return exact || part;
  }

'''

s = s[:i] + new_fn + s[j:]
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('findPlace replaced, len', len(s))
print('has PLACE_ALIAS:', 'PLACE_ALIAS' in s)
