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

  var online = null; // null=未知 true=在线 false=离线
  // ?ai=off 强制走本地规则（现场网络不通时用来稳定演示，README 里有说明）
  var FORCE_OFFLINE = /[?&]ai=off/.test(location.search);
  var conversationId = "";  // 多轮会话 id
  var busy = false;

  function setBadge() {
    if (online === true) {
      badge.textContent = "在线 · Dify";
      badge.className = "";
    } else if (online === false) {
      badge.textContent = "离线 · 本地规则";
      badge.className = "off";
    } else {
      badge.textContent = "就绪";
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
    var svc = card.service || findService(card.title || "");
    var c = el("div", "card");

    var head = el("div", "card-head");
    head.appendChild(el("b", null, card.title || (svc && svc.title) || "详情"));
    if (svc) {
      var campusNow = currentCampus();
      var has = (svc[campusNow] || []).length > 0;
      var other = campusNow === "north" ? svc.south : svc.north;
      var tag, cls;
      if (svc.online && !has) { tag = "💻 线上办理"; cls = "badge online"; }
      else if (has) { tag = "✅ 本校可办"; cls = "badge ok"; }
      else if ((other || []).length) {
        tag = "⚠️ 需到" + (campusNow === "north" ? "大学城" : "白云山") + "校区";
        cls = "badge warn";
      } else { tag = "⚪ 官网未公布地点"; cls = "badge mute"; }
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
      if (h.state === "open") line.textContent = "🟢 现在可办" + (h.closeAt ? " · " + h.closeAt + " 下班" : "");
      else if (h.state === "closed") line.textContent = "🔴 今日已下班" + (h.openAt ? " · 开放时间 " + h.openAt : "");
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
    return c;
  }

  var lastQuery = "";

  function addMsg(role, text, card) {
    var m = el("div", "msg " + role, text);
    if (card && (card.title || card.desc || card.service)) {
      m.appendChild(buildCard(card));
    }
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
    return m;
  }

  function addSys(text) {
    var m = el("div", "msg sys", text);
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
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
    TEXT_ALIAS.forEach(function (p) { if (src.indexOf(p[0]) >= 0) { src += " " + p[1]; } });
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
    return out.slice(0, 2).map(function (h) { return h.label; });
  }

  // ---------------- 动作执行 ----------------
  function applyAction(a) {
    if (!a) return;
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

  function askDify(q) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, CFG.timeout);
    return fetch(CFG.base + "/chat-messages", {
      method: "POST",
      headers: { Authorization: "Bearer " + CFG.key, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: {}, query: q, response_mode: "blocking", user: "web-gdufs", conversation_id: conversationId }),
      signal: ctrl.signal,
    })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        if (!j || typeof j.answer !== "string") throw new Error("bad payload");
        if (j.conversation_id) conversationId = j.conversation_id;
        return j.answer;
      });
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
    var spots = findPlaceInText(q);
    var navWords = /怎么去|怎么走|怎样去|如何到|路线|导航|多远|在哪|位置/.test(q);

    if (spots.length >= 2) {
      var r = nav.setPlaces(spots[1], spots[0]);
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
        text: parts.join("\n"),
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
  function send(text) {
    var q = (text != null ? text : input.value).trim();
    if (!q || busy) return;
    lastQuery = q;
    addMsg("user", q);
    input.value = "";
    busy = true;
    sendBtn.disabled = true;
    var waitLabel = online === false ? "本地规则检索中" : "正在查询校园知识库";
    var pending = addSys(waitLabel + "…");
    // 模型有时要 10 秒以上，把秒数显示出来，别让人以为卡死了
    var waitT0 = Date.now();
    var waitTick = setInterval(function () {
      if (pending && pending.parentNode) {
        pending.textContent = waitLabel + "… " + Math.round((Date.now() - waitT0) / 1000) + "s";
      }
    }, 1000);

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
      addMsg("bot", payload.answer || payload.text, card);
      applyAction(payload);
    };

    if (FORCE_OFFLINE || online === false || !CFG.key) {
      if (FORCE_OFFLINE) { online = false; setBadge(); }
      var local = localAnswer(q);
      setTimeout(function () { finish(local, false); }, 200);
      return;
    }

    askDify(q)
      .then(function (raw) {
        online = true;
        setBadge();
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
        finish({ ...local, text: local.text, answer: local.text + "\n\n（Dify 未响应：" + String(err.message || err).slice(0, 60) + "，已切换到本地规则）" });
      });
  }

  sendBtn.addEventListener("click", function () { send(); });
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
  head.addEventListener("click", function () {
    panel.classList.toggle("collapsed");
    document.getElementById("ai-toggle").textContent = panel.classList.contains("collapsed") ? "▸" : "▾";
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
  if (av) av.textContent = (window.GDUFS_LANG && window.GDUFS_LANG.get() === "en") ? "Y" : "语";

  addMsg("bot", NORTH ? T("ai.greet.north") : T("ai.greet"));
  if (FORCE_OFFLINE) online = false;
  setBadge();

  // 深链 ?q=… ：从卡片或外链带问题进来时自动问一次
  var q0 = /[?&]q=([^&]+)/.exec(location.search);
  if (q0) {
    var text0 = decodeURIComponent(q0[1].replace(/\+/g, " "));
    setTimeout(function () {
      var inp = document.querySelector("#ai-input");
      if (inp) inp.value = text0;
      send(text0);
    }, 700);
  }
})();
