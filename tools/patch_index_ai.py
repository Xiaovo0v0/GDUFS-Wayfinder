import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\index.html'
s = io.open(p, encoding='utf-8').read()

css_anchor = """  #compass {"""
css_add = """  /* ---------- AI 向导面板 ---------- */
  #ai {
    position: fixed; right: 20px; bottom: 92px; width: 368px; max-height: 66vh;
    display: flex; flex-direction: column; z-index: 30;
    background: rgba(16, 22, 30, 0.95); color: #e8eef6;
    border: 1px solid #2c3947; border-radius: 14px;
    box-shadow: 0 10px 34px rgba(0,0,0,.45); backdrop-filter: blur(8px);
    font-size: 13px;
  }
  #ai.collapsed .ai-body, #ai.collapsed .ai-input { display: none; }
  #ai-head {
    display: flex; align-items: center; gap: 8px; padding: 10px 12px;
    border-bottom: 1px solid #26313d; cursor: pointer; user-select: none;
  }
  #ai-head b { font-size: 13.5px; font-weight: 600; }
  #ai-badge {
    font-size: 10.5px; padding: 1px 7px; border-radius: 9px;
    background: #1f3a2c; color: #7ee0a0; border: 1px solid #2f6b4a;
  }
  #ai-badge.off { background: #3a2a1f; color: #ffb27e; border-color: #6b4a2f; }
  #ai-body { padding: 10px 12px; overflow-y: auto; max-height: 44vh; display: flex; flex-direction: column; gap: 8px; }
  .msg { line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  .msg.user { align-self: flex-end; background: #1d3a5c; border: 1px solid #2b5580; border-radius: 10px 10px 2px 10px; padding: 6px 9px; max-width: 86%; }
  .msg.bot { align-self: flex-start; background: #18222d; border: 1px solid #2a3644; border-radius: 10px 10px 10px 2px; padding: 6px 9px; max-width: 92%; }
  .msg.bot a { color: #7fc4ff; }
  .msg.sys { align-self: center; color: #8fa2b6; font-size: 11.5px; }
  .card { margin-top: 6px; border: 1px solid #2f4256; border-radius: 8px; padding: 7px 9px; background: #141d27; }
  .card b { color: #ffd479; font-weight: 600; }
  .card .meta { color: #9fb2c6; font-size: 11.5px; margin-top: 2px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 8px; }
  .chip { font-size: 11.5px; padding: 3px 8px; border-radius: 12px; border: 1px solid #33455a; background: #18222d; color: #b9cbe0; cursor: pointer; }
  .chip:hover { border-color: #4d6b8c; color: #dfeaf7; }
  .ai-input { display: flex; gap: 6px; padding: 8px 10px 10px; border-top: 1px solid #26313d; }
  .ai-input input {
    flex: 1; background: #0f171f; border: 1px solid #2b3949; border-radius: 8px;
    color: #e8eef6; padding: 7px 9px; font-size: 13px; font-family: inherit;
  }
  .ai-input input:focus { outline: none; border-color: #3f6c9a; }
  .ai-input button {
    border: 1px solid #2f5f8f; background: #1d3a5c; color: #dbeaff;
    padding: 7px 12px; border-radius: 8px; cursor: pointer; font-size: 13px;
  }
  .ai-input button:disabled { opacity: .5; cursor: default; }

  #compass {"""

s = s.replace(css_anchor, css_add, 1)

body_anchor = """<div id="compass"><div id="needle">▲</div><div class="n">北</div></div>"""
body_add = body_anchor + """

<div id="ai">
  <div id="ai-head">
    <span>🧭</span><b>校园向导</b>
    <span id="ai-badge">连接中…</span>
    <span style="margin-left:auto;color:#7b8ea3" id="ai-toggle">▾</span>
  </div>
  <div id="ai-body"></div>
  <div class="chips" id="ai-chips"></div>
  <div class="ai-input">
    <input id="ai-input" placeholder="问：从文采园怎么去图书馆？" autocomplete="off" />
    <button id="ai-send">发送</button>
  </div>
</div>"""
s = s.replace(body_anchor, body_add, 1)

script_anchor = """<script src="gdufs-data.js"></script>
<script src="app.js"></script>"""
script_add = """<script src="gdufs-data.js"></script>
<script src="faq-data.js"></script>
<script src="app.js"></script>
<script src="navigator-ui.js"></script>"""
s = s.replace(script_anchor, script_add, 1)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('index.html patched', len(s))
