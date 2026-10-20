import io

# ---------- 1) index.html：加卡片 DOM / CSS / 脚本 ----------
p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\index.html'
s = io.open(p, encoding='utf-8').read()

css_anchor = "  /* ---------- AI 向导面板 ---------- */"
css_add = """  /* ---------- 建筑信息卡 ---------- */
  #bcard {
    position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
    width: min(520px, calc(100vw - 420px)); z-index: 28;
    background: rgba(16, 22, 30, 0.96); color: #e8eef6;
    border: 1px solid #2c3947; border-radius: 12px; padding: 12px 14px 11px;
    box-shadow: 0 10px 30px rgba(0,0,0,.45); backdrop-filter: blur(8px);
    font-size: 12.5px; line-height: 1.6;
  }
  #bcard.hidden { display: none; }
  #bcard h2 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
  #bcard .meta { color: #9fb2c6; font-size: 11.5px; margin-bottom: 6px; }
  #bcard .meta b { color: #ffd479; font-weight: 600; }
  #bcard .func { color: #d5e0ec; margin: 0 0 6px; }
  #bcard .foot { color: #7f93a8; font-size: 11px; display: flex; gap: 10px; flex-wrap: wrap; }
  #bcard .foot a { color: #7fc4ff; text-decoration: none; }
  #bcard .x {
    position: absolute; right: 8px; top: 6px; background: none; border: 0;
    color: #7f93a8; font-size: 18px; cursor: pointer; line-height: 1;
  }
  #bcard .x:hover { color: #fff; }

"""
s = s.replace(css_anchor, css_add + css_anchor, 1)

body_anchor = """<div id="ai">"""
body_add = """<div id="bcard" class="hidden">
  <button class="x" id="bcard-x">×</button>
  <h2 id="bcard-name"></h2>
  <div class="meta" id="bcard-meta"></div>
  <p class="func" id="bcard-func"></p>
  <div class="foot" id="bcard-foot"></div>
</div>

<div id="ai">"""
s = s.replace(body_anchor, body_add, 1)

script_anchor = '<script src="faq-data.js"></script>'
script_add = '<script src="faq-data.js"></script>\n<script src="info-data.js"></script>'
s = s.replace(script_anchor, script_add, 1)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('index patched', len(s))

# ---------- 2) app.js：点击建筑时回调 ----------
p2 = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\app.js'
a = io.open(p2, encoding='utf-8').read()
anchor = """    if (!place) { setStatus('<span class="warn">该建筑未命名，无法作为导航点。</span>'); return; }"""
add = """    if (window.__onBuildingClick) {
      try { window.__onBuildingClick(b); } catch (err) { /* 忽略面板异常 */ }
    }
    if (!place) { setStatus('<span class="warn">该建筑未命名，无法作为导航点。</span>'); return; }"""
if anchor not in a:
    print('MISS click anchor')
else:
    a = a.replace(anchor, add, 1)
io.open(p2, 'w', encoding='utf-8', newline='\n').write(a)
print('app patched', len(a))
