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

  function addMsg(role, text, card) {
    var m = el("div", "msg " + role, text);
    if (card && (card.title || card.desc)) {
      var c = el("div", "card");
      var t = el("div");
      t.appendChild(el("b", null, card.title || "详情"));
      c.appendChild(t);
      if (card.desc) c.appendChild(el("div", "meta", card.desc));
      if (card.url) {
        var a = document.createElement("a");
        a.href = card.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "查看官方页面 ↗";
        a.style.display = "inline-block";
        a.style.marginTop = "4px";
        a.style.fontSize = "11.5px";
        c.appendChild(a);
      }
      m.appendChild(c);
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
      var parts = [];
      if (it.d) parts.push("部门：" + it.d);
      if (it.l) parts.push("地点：" + it.l);
      if (it.h) parts.push("时间：" + it.h);
      if (it.m) parts.push("材料：" + it.m);
      if (it.s) parts.push("流程：" + it.s);
      if (it.p) parts.push("电话：" + it.p);
      return {
        text: parts.join("\n"),
        card: { title: it.t, desc: it.d || "", url: it.u || it.src || "" },
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
    addMsg("user", q);
    input.value = "";
    busy = true;
    sendBtn.disabled = true;
    var pending = addSys(online === false ? "本地规则检索中…" : "正在查询校园知识库…");

    var finish = function (payload, isOnline) {
      busy = false;
      sendBtn.disabled = false;
      if (pending) pending.remove();
      addMsg("bot", payload.answer || payload.text, payload.card);
      applyAction(payload);
    };

    if (online === false || !CFG.key) {
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
          finish({ answer: raw });
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

  var SUGGEST = ["从文采园怎么去图书馆？", "成绩单在哪办？", "图书馆几层？", "一共有几个校门？"];
  SUGGEST.forEach(function (s) {
    var c = el("div", "chip", s);
    c.addEventListener("click", function () { send(s); });
    chips.appendChild(c);
  });

  addMsg("bot", "你好，我是广外校园向导 🧭\n可以问我校园导航（会直接在地图上画路线）、办事流程、楼栋信息。");
  setBadge();
})();
