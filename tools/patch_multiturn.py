import io

p = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\navigator-ui.js'
s = io.open(p, encoding='utf-8').read()

# 1) conversation id 变量
a = '  var online = null; // null=未知 true=在线 false=离线'
b = '  var online = null; // null=未知 true=在线 false=离线\n  var conversationId = "";  // 多轮会话 id'
if a not in s:
    raise SystemExit('MISS online anchor')
s = s.replace(a, b, 1)

# 2) 请求体带上 conversation_id，响应里记住
a2 = '      body: JSON.stringify({ inputs: {}, query: q, response_mode: "blocking", user: "web-" + Date.now() }),'
b2 = '      body: JSON.stringify({ inputs: {}, query: q, response_mode: "blocking", user: "web-gdufs", conversation_id: conversationId }),'
if a2 not in s:
    raise SystemExit('MISS body anchor')
s = s.replace(a2, b2, 1)

a3 = """      .then(function (j) {
        if (!j || typeof j.answer !== "string") throw new Error("bad payload");
        return j.answer;
      });"""
b3 = """      .then(function (j) {
        if (!j || typeof j.answer !== "string") throw new Error("bad payload");
        if (j.conversation_id) conversationId = j.conversation_id;
        return j.answer;
      });"""
if a3 not in s:
    raise SystemExit('MISS then anchor')
s = s.replace(a3, b3, 1)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('navigator-ui patched', len(s))
