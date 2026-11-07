/**
 * 校园向导 AI 面板
 * - 在线：调用 Dify Chatflow（/v1/chat-messages），解析 JSON 动作驱动地图
 * - 离线：Dify 不可达时，用本地规则（地名匹配 + FAQ 关键词）兜底
 */
(function () {
  "use strict";

  var CFG = window.GDUFS_AI || {
    base: "http://172.17.1.46/v1",
    key: "",
    timeout: 45000,
  };

  var nav = window.__navDebug;
  var body = document.getElementById("ai-body");
  var input = document.getElementById("ai-input");
  var sendBtn = document.getElementById("ai-send");
  var badge = document.getElementById("ai-badge");
  var chips = document.getElementById("ai-chips");
  var panel = document.getElementById("ai");
  var head = document.getElementById("ai-head");
  var aiOpenBtn = document.getElementById("ai-open");
  var aiCloseBtn = document.getElementById("ai-close");

  // 手机端：语心默认收起，从顶栏按钮打开成浮层；桌面端常驻，逻辑不参与
  function phoneLayout() {
    return window.matchMedia("(max-width: 760px)").matches;
  }
  function setAiOpen(open) {
    if (!phoneLayout()) return;
    panel.classList.toggle("open", !!open);
    document.body.classList.toggle("ai-open", !!open);
    if (aiOpenBtn) {
      aiOpenBtn.classList.toggle("on", !!open);
      aiOpenBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (open) {
      // 展开后滚到最新一条，别让用户自己找
      setTimeout(function () { body.scrollTop = body.scrollHeight; }, 60);
    }
  }

  var online = null; // null=未知 true=在线 false=离线
  // ?ai=off 强制走本地规则（现场网络不通时用来稳定演示，README 里有说明）
  var FORCE_OFFLINE = /[?&]ai=off/.test(location.search);
  var conversationId = "";  // 多轮会话 id
  var busy = false;

  function setBadge() {
    if (online === true) {
      badge.textContent = "Dify 在线";
      badge.className = "";
    } else if (online === false) {
      badge.textContent = FORCE_OFFLINE ? "离线 · 本地查询" : "Dify 未连接 · 本地查询";
      badge.className = "off";
    } else {
      badge.textContent = CFG.key ? "Dify 待连接" : "Dify 未配置";
      badge.className = "";
    }
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------------- 办事卡片（C3） ----------------
  var WD = { "周一": 1, "周二": 2, "周三": 3, "周四": 4, "周五": 5, "周六": 6, "周日": 0, "周天": 0 };

  function currentCampus() {
    return /[?&]campus=north/.test(location.search) ? "north" : "south";
  }

  // 解析"周一、周二 8:30-12:00、14:00-17:10（北校区）"这类时段，判断此刻能不能办
  function parseHours(text, campus) {
    if (!text) return { state: "unknown", text: "" };
    // 注意：不能因为出现"另行通知"就整体判为未知——多数条目仍带着常规时段
    var segs = String(text).split(/[；;]/);
    var picked = segs.filter(function (s) {
      if (campus === "north") return /北校区|北校/.test(s);
      if (campus === "south") return /南校区|南校|大学城/.test(s);
      return true;
    });
    var src = (picked.length ? picked : segs).join("；");

    var days = [], m, re = /周[一二三四五六日天]/g;
    while ((m = re.exec(src))) {
      var d = WD[m[0]];
      if (d != null && days.indexOf(d) < 0) days.push(d);
    }
    var ranges = [], rre = /(\d{1,2})[:：](\d{2})\s*[-–~至]\s*(\d{1,2})[:：](\d{2})/g;
    while ((m = rre.exec(src))) {
      ranges.push([(+m[1]) * 60 + (+m[2]), (+m[3]) * 60 + (+m[4])]);
    }
    if (!days.length && !ranges.length) return { state: "unknown", text: src };

    var now = new Date();
    var dow = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var dayOk = days.length ? days.indexOf(dow) >= 0 : true;
    var openNow = false, closeAt = null;
    for (var i = 0; i < ranges.length; i++) {
      if (mins >= ranges[i][0] && mins <= ranges[i][1]) {
        openNow = true;
        closeAt = ranges[i][1];
        break;
      }
    }
    var state = (dayOk && openNow) ? "open" : "closed";
    var hhmm = function (v) {
      return ("0" + Math.floor(v / 60)).slice(-2) + ":" + ("0" + (v % 60)).slice(-2);
    };
    return {
      state: state,
      text: src,
      closeAt: closeAt != null ? hhmm(closeAt) : null,
      openAt: ranges.length ? hhmm(ranges[0][0]) : null
    };
  }

  // 按标题做粗匹配，把本地办事数据挂到卡片上
  function findService(title) {
    var list = window.GDUFS_SERVICE || [];
    var g = bigrams(title || "");
    if (!g.length) return null;
    var best = null, bestScore = 0;
    list.forEach(function (it) {
      var text = (it.title || "").replace(/[（）()\s]/g, "");
      var score = 0;
      g.forEach(function (x) { if (text.indexOf(x) >= 0) score += 1; });
      if (score > bestScore) { bestScore = score; best = it; }
    });
    return bestScore >= Math.max(3, Math.floor(g.length * 0.45)) ? best : null;
  }

  // 电话按当前校区挑（原文常写成"020-xxx（北校区）、020-yyy（南校区）"）
  function pickPhone(phone) {
    var parts = String(phone).split(/[、,，;；\s]+/).filter(Boolean);
    if (!parts.length) return "";
    var want = currentCampus() === "north" ? /北校区|北校/ : /南校区|南校|大学城/;
    for (var i = 0; i < parts.length; i++) {
      if (want.test(parts[i])) return parts[i].replace(/[（(].*?[）)]/g, "").trim();
    }
    return parts[0].replace(/[（(].*?[）)]/g, "").trim();
  }

  function placeFor(svc) {
    if (!svc) return null;
    var c = currentCampus();
    var list = svc[c] || [];
    return list.length ? list[0] : (svc.south[0] || svc.north[0] || null);
  }

  function buildCard(card) {
    var localSvc=(window.GDUFS_SERVICE||[]).find(function(s){return card.service&&(s.sid===card.service.sid||s.title===card.service.title);})||findService(card.title||'');
    if(localSvc&&window.WayfinderServices){localServiceContext=localSvc;return window.WayfinderServices.render(localSvc);}
    var svc = card.service || findService(card.title || "");
    var c = el("div", "card");

    var head = el("div", "card-head");
    head.appendChild(el("b", null, card.title || (svc && svc.title) || "详情"));
    if (svc) {
      var campusNow = currentCampus();
      var has = (svc[campusNow] || []).length > 0;
      var other = campusNow === "north" ? svc.south : svc.north;
      var tag, cls;
      if (svc.online && !has) { tag = "线上办理"; cls = "badge online"; }
      else if (has) { tag = "本校可办"; cls = "badge ok"; }
      else if ((other || []).length) {
        tag = "需到" + (campusNow === "north" ? "大学城" : "白云山") + "校区";
        cls = "badge warn";
      } else { tag = "地点待确认"; cls = "badge mute"; }
      head.appendChild(el("span", cls, tag));
      if (cls === "badge warn") {
        var toCampus = campusNow === "north" ? "south" : "north";
        var sw = el("button", "act switch",
          "🔄 去" + (toCampus === "north" ? "白云山" : "大学城") + "校区看");
        sw.addEventListener("click", function () {
          var qs = "?campus=" + toCampus;
          if (lastQuery) qs += "&q=" + encodeURIComponent(lastQuery);
          location.href = location.pathname + qs;
        });
        head.appendChild(sw);
      }
    }
    c.appendChild(head);

    if (card.desc) c.appendChild(el("div", "meta", card.desc));
    if (svc && svc.dept) c.appendChild(el("div", "meta", "部门：" + svc.dept));

    var p = placeFor(svc);
    if (p && p.name) {
      var loc = "地点：" + (p.building_id && p.building_id.charAt(0) === "N" ? "白云山 · " : "大学城 · ") +
        p.name + (p.room ? " " + p.room + " 室" : "");
      c.appendChild(el("div", "meta", loc));
    } else if (svc && svc.online) {
      c.appendChild(el("div", "meta", "地点：线上办理"));
    }

    if (svc && svc.hours) {
      var h = parseHours(svc.hours, currentCampus());
      var line = el("div", "hours " + h.state);
      if (h.state === "open") line.textContent = "常规开放" + (h.closeAt ? " · " + h.closeAt + " 下班" : "");
      else if (h.state === "closed") line.textContent = "常规时段外" + (h.openAt ? " · 开放时间 " + h.openAt : "");
      else line.textContent = "⚪ 办公时间：官网未公布";
      c.appendChild(line);
      if (h.state !== "unknown") c.appendChild(el("div", "meta sub", h.text));
    }

    if (svc && svc.materials && svc.materials.length) {
      var mw = el("div", "mats");
      mw.appendChild(el("div", "meta", "材料（" + svc.materials.length + " 项）"));
      svc.materials.slice(0, 3).forEach(function (m) {
        mw.appendChild(el("div", "mat-item", "· " + m));
      });
      if (svc.materials.length > 3) mw.appendChild(el("div", "meta", "……共 " + svc.materials.length + " 项"));
      c.appendChild(mw);
    }

    var acts = el("div", "acts");
    if (p && p.name) {
      var b1 = el("button", "act", "🗺 导航到这里");
      b1.addEventListener("click", function () {
        var r = nav.setPlaces("", p.name);
        var t = nav.findPlace(p.name);
        if (t) nav.flyTo(t.x, t.z, 150, 320);
        if(t) { document.body.classList.remove('answer-mode'); window.dispatchEvent(new CustomEvent('wayfinder:destination',{detail:t.label})); }
        addSys(r && r.to ? "已在地图上定位到「" + r.to + "」，选个起点就能画路线" : "未找到该地点");
      });
      acts.appendChild(b1);
    }
    if (svc && svc.phone) {
      var phone = pickPhone(svc.phone);
      if (phone) {
        var b2 = el("button", "act", "📞 " + phone);
        b2.addEventListener("click", function () { location.href = "tel:" + phone; });
        acts.appendChild(b2);
      }
    }
    if (svc && svc.materials && svc.materials.length) {
      var b3 = el("button", "act", "📋 复制材料");
      b3.addEventListener("click", function () {
        var txt = svc.materials.join("\n");
        if (navigator.clipboard) {
          navigator.clipboard.writeText(txt).then(function () { addSys("材料清单已复制"); },
            function () { addSys("复制失败，请手动选择"); });
        } else { addSys("当前环境不支持剪贴板"); }
      });
      acts.appendChild(b3);
    }
    var srcUrl = (svc && (svc.url || svc.src)) || card.url;
    if (srcUrl) {
      var b4 = el("button", "act", "🔗 官方原文");
      b4.addEventListener("click", function () { window.open(srcUrl, "_blank", "noopener"); });
      acts.appendChild(b4);
    }
    if (acts.children.length) c.appendChild(acts);
    var details = el('details'); details.appendChild(el('summary',null,window.GDUFS_LANG.get()==='en'?'Service details':'办理须知'));
    Array.from(c.children).forEach(function(n){if(n!==head&&n!==acts&&!(n.textContent||'').startsWith('地点：'))details.appendChild(n);});
    Array.from(acts.children).forEach(function(n){if(n.textContent.indexOf('导航')<0)details.appendChild(n);else{n.textContent=window.GDUFS_LANG.get()==='en'?'Directions':'到这里';n.className='primary';}});
    c.appendChild(details);
    return c;
  }

  var lastQuery = "";
  var localServiceContext = null;
  function nearBottom() { return body.scrollHeight - body.clientHeight - body.scrollTop < 80; }

  function addMsg(role, text, card) {
    var follow = nearBottom();
    var m = el("div", "msg " + role);
    if (role === 'bot') window.renderWayfinderMarkdown(m, text); else m.textContent = text;
    if (card && (card.title || card.desc || card.service)) {
      m.appendChild(buildCard(card));
    }
    body.appendChild(m);
    if (follow || role === 'user') body.scrollTop = body.scrollHeight;
    return m;
  }

  function addSys(text) {
    var follow = nearBottom();
    var m = el("div", "msg sys", text);
    body.appendChild(m);
    if (follow) body.scrollTop = body.scrollHeight;
    return m;
  }

  // ---------------- 地点匹配 ----------------
  function norm(s) {
    return (s || "").replace(/[（(].*?[）)]/g, "").replace(/[\s·、,，]/g, "").toLowerCase();
  }

  var TEXT_ALIAS = [
    ["一饭", "文采园"], ["一食堂", "文采园"],
    ["二饭", "博雅园"], ["二食堂", "博雅园"],
    ["三饭", "风采园"], ["三食堂", "风采园"],
    ["校医院", "门诊部"], ["大礼堂", "大会堂"], ["羽球馆", "体育馆"], ["主校门", "正门"]
  ];

  function findPlaceInText(text) {
    if (!nav || !nav.placeLabels) return [];
    var src = text || "";
    TEXT_ALIAS.forEach(function (p) { if (src.indexOf(p[0]) >= 0 && nav.findPlace(p[1])) { src = src.replace(p[0], p[1]); } });
    var t = norm(src);
    var hits = [];
    nav.placeLabels.forEach(function (label) {
      var n = norm(label);
      if (n && t.indexOf(n) >= 0) hits.push({ label: label, idx: t.indexOf(n), len: n.length });
    });
    // 长名优先，去掉被更长名包含的短名（如"图书馆" vs "大学城校区图书馆"）
    hits.sort(function (a, b) { return b.len - a.len; });
    var out = [];
    hits.forEach(function (h) {
      var covered = out.some(function (o) {
        return Math.abs(o.idx - h.idx) < 2 && o.len > h.len;
      });
      if (!covered) out.push(h);
    });
    return out.sort(function(a,b){return a.idx-b.idx;}).slice(0, 2).map(function (h) { return h.label; });
  }

  function routeRequest(q) {
    if (!/(?:从.+(?:去|到)|怎么去|怎么走|怎样去|路线|导航|带我去)/.test(q)) return null;
    var campus = currentCampus();
    if (campus === 'south' && /北门/.test(q) && !nav.placeLabels.includes('北门')) {
      return { answer:'北门在白云山校区。请切换到白云山校区后再规划路线。', action:'switch-campus', campus:'north' };
    }
    var spots = findPlaceInText(q);
    if (spots.length < 2) return null;
    var from = nav.findPlace(spots[0]), to = nav.findPlace(spots[1]);
    if (!from || !to || from.label === to.label) return { answer:'请确认起点和终点。' };
    var result = nav.setPlaces(from.label,to.label);
    var distance = Math.round(Number(document.getElementById('status')?.dataset.dist)||0);
    if (!result || !result.routed || distance <= 0) return { answer:'这两个地点暂时无法沿校内道路连通。请换一个起点或终点。' };
    return { answer:from.label+' → '+to.label+'\n步行约 '+distance+' 米 · '+Math.max(1,Math.round(distance/70))+' 分钟', routed:true };
  }

  // ---------------- 动作执行 ----------------
  function applyAction(a) {
    if (!a) return;
    if (a.intent === "navigate" && lastHadLoc && a.to) {
      // 问句里带"我这里/我的位置"：按前端的真实定位点重算，别从最近地标起步
      a = { intent: a.intent, from: "我的位置", to: a.to, answer: a.answer, card: a.card };
    }
    var place = a.intent === "navigate" ? (a.to || a.place || "") : (a.place || "");
    if (a.intent === "navigate" && (a.from || a.to)) {
      var r = nav.setPlaces(a.from || "", a.to || "");
      if (r && r.from && r.to) {
        var f = nav.findPlace(r.from), t = nav.findPlace(r.to);
        if (f && t) {
          nav.flyTo((f.x + t.x) / 2, (f.z + t.z) / 2, 260, 520);
        }
        addSys("已在图上标出：" + r.from + " → " + r.to);
      } else if (r && r.to) {
        var t2 = nav.findPlace(r.to);
        if (t2) nav.flyTo(t2.x, t2.z, 140, 300);
        addSys("已定位到：" + r.to + "（请再选起点）");
      }
      return;
    }
    var p = place || (a.card && a.card.title);
    var fp = p ? nav.findPlace(p) : null;
    if (fp) {
      nav.flyTo(fp.x, fp.z, 120, 260);
      addSys("已在地图上定位：" + fp.label);
    }
  }

  // ---------------- 定位（"我的位置"） ----------------
  var lastHadLoc = false;

  function myPlaceInfo() {
    return (nav && nav.getMyPosition) ? nav.getMyPosition() : null;
  }
  function locWords(q) {
    return /我这里|我这儿|我这|我现在|我的位置|我在哪|我附近|我身边|离我/.test(q || "");
  }
  // 最近的、且不是问题里已经点到的那几个地名（避免"图书馆附近去图书馆"）
  function nearLabelFor(q, exclude) {
    var list = (nav && nav.nearbyPlaces) ? nav.nearbyPlaces(8) : [];
    for (var i = 0; i < list.length; i++) {
      var hit = (exclude || []).some(function (s) { return s === list[i].label; });
      if (!hit) return list[i].label;
    }
    return null;
  }
  function myLocationText() {
    var me = myPlaceInfo();
    if (!me) return null;
    var near = me.nearest || (nav.nearestPlace && nav.nearestPlace());
    var list = (nav.nearbyPlaces ? nav.nearbyPlaces(4) : []).filter(function (p) {
      return !near || p.label !== near.label;
    });
    var lines = [];
    lines.push(near
      ? "你现在在「" + near.label + "」附近，直线约 " + Math.round(near.dist) + " 米（定位精度 ±" + Math.round(me.accuracy) + " 米）。"
      : "已定位到你的位置（精度 ±" + Math.round(me.accuracy) + " 米）。");
    if (list.length) {
      lines.push("附近还有：" + list.slice(0, 3).map(function (p) {
        return p.label + " " + Math.round(p.dist) + " 米";
      }).join("、"));
    }
    lines.push("说「去图书馆」，我就从你这里开始算路。");
    return lines.join("\n");
  }

  // ---------------- 在线：Dify ----------------
  function parseJson(text) {
    if (!text) return null;
    var s = String(text).trim();
    // 推理型模型（Qwen / R1 等）会带 <think>…</think>，先整段剥掉再找 JSON
    s = s.replace(/<think[^>]*>[\s\S]*?<\/think>/gi, "").trim();
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    var m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) s = m[1].trim();
    var i = s.indexOf("{"), j = s.lastIndexOf("}");
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  // 模型生成的是 {"intent":…,"answer":"…"} 这种 JSON 外壳，流式输出时外壳先到，
  // 把 answer 字段的值边收边解出来，用户就能看到文字一个个冒出来，而不是干等 20 秒。
  function partialAnswer(s) {
    var t = String(s || "");
    // Qwen3.8-27B 这类推理模型边写边吐 <think>…</think>，思考过程不能当正文流给用户
    t = t.replace(/<think[^>]*>[\s\S]*?<\/think>/gi, "");
    var open = t.search(/<think[^>]*>/i);
    if (open >= 0) t = t.slice(0, open);
    t = t.replace(/<\/think>/gi, "");
    var head = t.replace(/^\s*```(?:json)?\s*/i, "");
    if (head.charAt(0) !== "{") return head;        // 百科/闲聊分支是纯文本，直接流
    var i = head.indexOf('"answer"');
    if (i < 0) return "";
    var j = head.indexOf(":", i);
    if (j < 0) return "";
    j++;
    while (j < head.length && /\s/.test(head.charAt(j))) j++;
    if (head.charAt(j) !== '"') return "";
    j++;
    var out = "", esc = false;
    for (; j < head.length; j++) {
      var c = head.charAt(j);
      if (esc) { out += c === "n" ? "\n" : (c === "t" ? "  " : (c === "u" ? "" : c)); esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') break;
      out += c;
    }
    return out;
  }

  // 把 Dify 那串 PluginInvokeError 压成一句人话（原文太长，气泡里放不下）
  function shortErr(e) {
    var s = typeof e === "string" ? e : JSON.stringify(e == null ? "" : e);
    if (/Connection refused/i.test(s)) return "模型服务连不上（Connection refused）";
    if (/timed? ?out|timeout/i.test(s)) return "模型服务超时";
    if (/status code 5\d\d/.test(s)) return "模型服务返回 5xx";
    return s.replace(/\s+/g, " ").slice(0, 80);
  }

  // 流式调用：onDelta(当前可见文本) 每收到一段就回调一次
  window.__uiBuild = "stream-5";
  function askDify(q, onDelta) {
    var ctrl = new AbortController();
    var timer = null;
    var arm = function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { ctrl.abort(); }, CFG.timeout);
    };
    arm();
    var acc = "";

    var feed = function (chunk) {
      acc += chunk;
      var vis = partialAnswer(acc);
      if (vis && onDelta) onDelta(vis);
    };

    var parseBlock = function (block) {
      var lines = block.split("\n");
      var dataLine = null;
      for (var k = 0; k < lines.length; k++) {
        if (lines[k].indexOf("data:") === 0) { dataLine = lines[k].slice(5).trim(); break; }
      }
      if (!dataLine || dataLine === "[DONE]") return;
      var ev;
      try { ev = JSON.parse(dataLine); } catch (e) { return; }
      if (ev.conversation_id) conversationId = ev.conversation_id;
      // chatflow 的 message 事件把字段放在顶层，agent 模式放在 data 里，两种都要认
      var d = ev.data || ev;
      // chatflow 失败时 Dify 只发 workflow_finished(status=failed)，不发 error 事件；
      // 旧代码把它当成“回答为空”静默收尾 —— 用户看到的就是“问了没反应”。这里必须抛。
      if (ev.event === "workflow_finished" && (d.status === "failed" || ev.status === "failed")) {
        if (!acc.trim()) throw new Error("Dify 工作流失败：" + shortErr(d.error || ev.error));
      }
      if (ev.event === "message" || ev.event === "agent_message") {
        if (typeof d.answer === "string") feed(d.answer);
      } else if (ev.event === "message_end" && (d.conversation_id || ev.conversation_id)) {
        conversationId = d.conversation_id || ev.conversation_id || conversationId;
      } else if (ev.event === "error") {
        throw new Error(d.message || d.code || "dify error");
      }
    };

    return fetch(CFG.base + "/chat-messages", {
      method: "POST",
      headers: { Authorization: "Bearer " + CFG.key, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ inputs: (function(){var p=findPlaceInText(q);return {campus:currentCampus(),from_name:p.length>1?p[0]:'',to_name:p.length>1?p[1]:''};})(), query: q, response_mode: "streaming", user: "web-gdufs", conversation_id: conversationId }),
      signal: ctrl.signal,
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        if (/text\/html/i.test(r.headers.get('Content-Type') || '')) throw new Error('Dify requires campus network or VPN');
        if (!r.body || !r.body.getReader) {
          // 老浏览器不支持流：退回整段读
          return r.text().then(function (all) {
            clearTimeout(timer);
            all.split("\n\n").forEach(parseBlock);
            return acc;
          });
        }
        var reader = r.body.getReader();
        var dec = new TextDecoder("utf-8");
        var buf = "";
        var pump = function () {
          return reader.read().then(function (res) {
            if (res.done) { clearTimeout(timer); return acc; }
            arm();
            buf += dec.decode(res.value, { stream: true });
            var parts = buf.split("\n\n");
            buf = parts.pop();
            for (var i = 0; i < parts.length; i++) parseBlock(parts[i]);
            return pump();
          });
        };
        return pump();
      })
      .catch(function (e) { clearTimeout(timer); throw e; });
  }

  // ---------------- 离线：本地规则 ----------------
  var KW = ["成绩", "选课", "报销", "校园卡", "借书", "宿舍", "报修", "奖学金", "证明", "网络", "邮箱", "校车", "医保", "档案", "三方", "转专业", "辅修", "补考", "缓考", "体检", "挂号"];

  function bigrams(s) {
    var t = (s || "").replace(/[\s，。？！,.?!、：:；;“”"'（）()]/g, "");
    var out = [];
    for (var i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
    return out;
  }

  function localFaq(q) {
    var faq = window.GDUFS_FAQ || [];
    var grams = bigrams(q);
    var best = null, bestScore = 0;
    faq.forEach(function (it) {
      var text = (it.t + " " + it.d + " " + it.l).toLowerCase();
      var score = 0;
      grams.forEach(function (g) { if (text.indexOf(g) >= 0) score += 2; });
      KW.forEach(function (k) { if (q.indexOf(k) >= 0 && text.indexOf(k) >= 0) score += 6; });
      if (score > bestScore) { bestScore = score; best = it; }
    });
    if (bestScore >= 8) return best;
    return null;
  }

  function localAnswer(q) {
    if(/现在.*(能|办|开)|几点|什么材料|带什么|电话|找谁/.test(q)&&!findService(q)){if(localServiceContext)return{text:'',card:{title:localServiceContext.title,service:localServiceContext}};if(/现在.*(能|办|开)/.test(q))return{text:'请先告诉我要办理的事项。'};}
    var direct = findService(q);
    if (direct && !/怎么去|怎么走|路线|导航/.test(q)) return {text:'',card:{title:direct.title,service:direct}};
    var spots = findPlaceInText(q);
    var navWords = /怎么去|怎么走|怎样去|如何到|路线|导航|多远|在哪|位置|^去/.test(q);

    // 「我在哪 / 附近有什么」：定位是前端的确定性事实，不用绕大模型
    var me = myPlaceInfo();
    if (me && /我在哪|我在什么位置|我的位置|我附近|附近有|身边有/.test(q) &&
        !/怎么去|怎么走|路线|导航/.test(q)) {
      return { text: myLocationText(), card: null };
    }
    // 「我这里怎么去 XX」：起点用真实定位点，而不是最近的那个地标
    if (me && locWords(q) && spots.length === 1 && navWords) {
      var rMe = nav.setPlaces("我的位置", spots[0]);
      if (rMe && rMe.from && rMe.to) {
        var tm = nav.findPlace(rMe.to);
        if (tm) nav.flyTo((me.x + tm.x) / 2, (me.z + tm.z) / 2, 260, 520);
        return {
          text: "已从你现在的位置算到「" + rMe.to + "」：沿路步行约 " +
            Math.round(window.__lastRouteDist || 0) + " 米（离线模式，按道路网络计算）。",
          card: null
        };
      }
    }

    if (spots.length >= 2) {
      var r = nav.setPlaces(spots[0], spots[1]);
      if (r && r.from && r.to) {
        var f = nav.findPlace(r.from), t = nav.findPlace(r.to);
        if (f && t) nav.flyTo((f.x + t.x) / 2, (f.z + t.z) / 2, 260, 520);
        return { text: "已为你规划：" + r.from + " → " + r.to + "（离线模式，按道路网络计算）", card: null };
      }
    }
    if (spots.length === 1 && navWords) {
      var t2 = nav.findPlace(spots[0]);
      if (t2) {
        nav.setPlaces("", spots[0]);
        nav.flyTo(t2.x, t2.z, 140, 300);
        return { text: "已在地图上定位到「" + t2.label + "」。告诉我你的出发点，我可以画出步行路线。", card: null };
      }
    }
    var it = localFaq(q);
    if (it) {
      // 有本地办事数据时，用与卡片同源的字段组织答案，
      // 避免"文字说白云山、卡片说大学城"这种自相矛盾
      var svc = findService(it.t || "");
      var p = svc ? placeFor(svc) : null;
      var parts = [];
      if (it.d) parts.push("部门：" + it.d);
      if (p && p.name) {
        parts.push("地点：" + p.name + (p.room ? " " + p.room + " 室" : ""));
      } else if (it.l) {
        parts.push("地点：" + it.l);
      }
      if (svc && svc.hours) {
        var hh = parseHours(svc.hours, currentCampus());
        if (hh.state === "open") parts.push("时间：" + hh.text + "（现在可以办理）");
        else if (hh.state === "closed") parts.push("时间：" + hh.text + "（今日已下班）");
        else parts.push("时间：" + hh.text);
      } else if (it.h) {
        parts.push("时间：" + it.h);
      }
      if (it.m) parts.push("材料：" + it.m);
      if (it.s) parts.push("流程：" + it.s);
      if (it.p) parts.push("电话：" + it.p);
      return {
        text: "",
        card: { title: it.t, desc: it.d || "", url: it.u || it.src || "", service: null },
      };
    }
    return { text: "离线模式下我只能处理校园地点与常见办事事项。试试问我「从文采园怎么去图书馆」或「成绩单在哪办」。" };
  }

  // ---------------- 建筑信息卡 ----------------
  var bcard = document.getElementById("bcard");
  var bcardName = document.getElementById("bcard-name");
  var bcardMeta = document.getElementById("bcard-meta");
  var bcardFunc = document.getElementById("bcard-func");
  var bcardFoot = document.getElementById("bcard-foot");

  function esc(s) { return String(s == null ? "" : s).replace(/[<>&]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]; }); }

  function showBuildingCard(b) {
    var info = (window.GDUFS_INFO || {})[b.id];
    if (!info || !bcard) return;
    bcardName.textContent = info.name;
    var meta = [];
    if (info.type) meta.push(esc(info.type));
    if (info.floors) meta.push("层数 <b>" + esc(info.floors) + "</b>");
    else if (info.levels) meta.push("<b>" + info.levels + "</b> 层");
    meta.push("高 <b>" + info.height + " m</b>");
    meta.push("基底 <b>" + info.area.toLocaleString() + " ㎡</b>");
    bcardMeta.innerHTML = meta.join("　·　");
    bcardFunc.textContent = info.func || "";
    var foot = [];
    if (info.built) foot.push("建成：" + esc(info.built));
    if (info.hours) foot.push("开放：" + esc(info.hours));
    if (info.loc) foot.push("位置：" + esc(info.loc.slice(0, 40)) + (info.loc.length > 40 ? "…" : ""));
    var html = foot.map(function (f) { return "<span>" + f + "</span>"; }).join("");
    if (info.src) html += '<span><a href="' + esc(info.src) + '" target="_blank" rel="noopener">官方来源 ↗</a></span>';
    if (info.conf) html += "<span>置信度：" + esc(info.conf) + "</span>";
    bcardFoot.innerHTML = html;
    bcard.classList.remove("hidden");
  }

  window.__onBuildingClick = function (b) { showBuildingCard(b); };

  if (bcard) {
    document.getElementById("bcard-x").addEventListener("click", function () {
      bcard.classList.add("hidden");
    });
  }

  // ---------------- 交互 ----------------
  // 问题里带"我这里/我的位置"时，给 Dify 补一句"我现在在X附近"：
  // 算路代码节点按出现顺序取前两个地名，于是 from=最近地标、to=用户说的目的地，
  // Dify 那边一个节点都不用改，也不用把经纬度塞进提示词。
  function withMyLocation(q) {
    var me = myPlaceInfo();
    if (!me || !locWords(q)) return q;
    var near = nearLabelFor(q, findPlaceInText(q));
    if (!near) return q;
    return "我现在在" + near + "附近。" + q;
  }

  function send(text) {
    var q = (text != null ? text : input.value).trim();
    if (!q || busy) return;
    lastQuery = q;
    lastHadLoc = !!(myPlaceInfo() && locWords(q));
    addMsg("user", q);
    input.value = "";
    var directRoute = routeRequest(q);
    if (directRoute) {
      addMsg('bot',directRoute.answer);
      if (directRoute.routed) addSys('路线已绘制');
      if (directRoute.action === 'switch-campus') {
        var switchBtn=el('button','ai-campus-switch','切换到白云山校区');
        switchBtn.type='button';switchBtn.addEventListener('click',function(){var u=new URL(location.href);u.searchParams.set('campus',directRoute.campus);location.href=u.href;});body.appendChild(switchBtn);
      }
      return;
    }
    busy = true;
    sendBtn.disabled = true;
    var waitLabel = online === false ? "查询中" : "查询中";
    var pending = addSys(waitLabel + "…");
    // 模型有时要 10 秒以上，把秒数显示出来，别让人以为卡死了
    var waitT0 = Date.now();
    var waitTick = setInterval(function () {
      if (pending && pending.parentNode) {
        pending.textContent = waitLabel + "… " + Math.round((Date.now() - waitT0) / 1000) + "s";
      }
    }, 1000);

    // 流式：第一段文字到了就把等待条换成回答气泡，后面持续追加
    var liveEl = null;
    var onDelta = function (vis) {
      var follow = nearBottom();
      if (pending) { pending.remove(); pending = null; }
      if (!liveEl) {
        liveEl = addMsg("bot", vis, null);
      } else { window.renderWayfinderMarkdown(liveEl, vis); }
      if (follow) body.scrollTop = body.scrollHeight;
    };

    var finish = function (payload, isOnline) {
      busy = false;
      sendBtn.disabled = false;
      clearInterval(waitTick);
      if (pending) pending.remove();
      // 卡片统一补上本地办事数据（校区/楼栋/时段/材料），在线离线都走这一条
      var card = payload.card;
      if (card && !card.service) {
        card.service = findService(card.title || "");
      }
      var text = payload.answer || payload.text || "";
      if (liveEl) {
        var follow = nearBottom();
        window.renderWayfinderMarkdown(liveEl, text);
        if (card && (card.title || card.desc || card.service)) liveEl.appendChild(buildCard(card));
        if (follow) body.scrollTop = body.scrollHeight;
      } else {
        addMsg("bot", text, card);
      }
      applyAction(payload);
    };

    if (FORCE_OFFLINE || online === false || !CFG.key) {
      if (FORCE_OFFLINE) { online = false; setBadge(); }
      var local = localAnswer(q);
      setTimeout(function () { finish(local, false); }, 200);
      return;
    }

    askDify(withMyLocation(q), onDelta)
      .then(function (raw) {
        online = true;
        setBadge();
        // 200 但一个字都没解析出来（工作流失败/模型没响应）时也当失败处理，
        // 否则会渲染一个空气泡，用户看到的就是“问了没反应”。
        if (!String(raw || "").trim()) throw new Error("Dify 返回空内容（模型服务未响应）");
        var obj = parseJson(raw);
        if (!obj) {
          // 模型没按契约回 JSON（例如推理模型把答案写在 <think> 里），
          // 至少把思考块剥掉再展示，别让用户看到一堆推理过程
          var plain = String(raw).replace(/<think[^>]*>[\s\S]*?<\/think>/gi, "").trim();
          finish({ answer: plain || raw });
          return;
        }
        finish({ ...obj, text: obj.answer, answer: obj.answer });
      })
      .catch(function (err) {
        online = false;
        setBadge();
        var local = localAnswer(q);
        finish({ ...local, text: local.text, answer: (local.text || "") });
      });
  }

  window.GDUFS_ASSISTANT = { query: send, busy: function(){return busy;}, reconnect: function(){
    if (busy || !CFG.key || FORCE_OFFLINE) { setBadge(); return Promise.resolve(false); }
    badge.textContent = 'Dify 连接中…';
    var ctrl = new AbortController(), timer = setTimeout(function(){ctrl.abort();}, 10000);
    return fetch(CFG.base + '/parameters', {headers:{Authorization:'Bearer '+CFG.key,Accept:'application/json'},signal:ctrl.signal})
      .then(function(r){if(!r.ok || !/application\/json/i.test(r.headers.get('content-type')||'')) throw new Error('unavailable');return r.json();})
      .then(function(){online=true;setBadge();return true;})
      .catch(function(){online=false;setBadge();return false;})
      .finally(function(){clearTimeout(timer);});
  } };
  window.addEventListener('wayfinder:service-context',function(e){localServiceContext=(window.GDUFS_SERVICE||[]).find(function(s){return s.sid===e.detail;})||localServiceContext;});
  sendBtn.addEventListener("click", function () { send(); });
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
  head.addEventListener("click", function () {
    // 手机上「点头部 = 收起浮层」，和弹层习惯一致；桌面端仍保留折叠
    if (phoneLayout()) { setAiOpen(false); return; }
    panel.classList.toggle("collapsed");
    document.getElementById("ai-toggle").textContent = panel.classList.contains("collapsed") ? "▸" : "▾";
  });
  if (aiOpenBtn) aiOpenBtn.addEventListener("click", function () { setAiOpen(true); });
  if (aiCloseBtn) aiCloseBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    setAiOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("open")) setAiOpen(false);
  });

  var T = window.t || function (k) { return k; };
  var NORTH = currentCampus() === "north";
  var SUGGEST = NORTH
    ? [T("chip.north.1"), T("chip.north.2"), T("chip.north.3"), T("chip.north.4")]
    : [T("chip.1"), T("chip.2"), T("chip.3"), T("chip.4")];
  SUGGEST.forEach(function (s) {
    var c = el("div", "chip", s);
    c.addEventListener("click", function () { send(s); });
    chips.appendChild(c);
  });

  // 头像与名字跟随语言
  var av = document.querySelector("#ai-head .avatar");
  var enNow = window.GDUFS_LANG && window.GDUFS_LANG.get() === "en";
  if (av) av.textContent = enNow ? "Y" : "语";
  var avOpen = document.getElementById("ai-open-ava");
  if (avOpen) avOpen.textContent = enNow ? "Y" : "语";


  if (FORCE_OFFLINE) online = false;
  setBadge();

  // 深链 ?q=… ：从卡片或外链带问题进来时自动问一次
  var q0 = /[?&]q=([^&]+)/.exec(location.search);
  if (q0) {
    var text0 = decodeURIComponent(q0[1].replace(/\+/g, " "));
    // 手机端进来就让用户看到这条问答，而不是藏在收起的面板里
    setAiOpen(true);
    setTimeout(function () {
      var inp = document.querySelector("#ai-input");
      if (inp) inp.value = text0;
      send(text0);
    }, 700);
  }
})();
