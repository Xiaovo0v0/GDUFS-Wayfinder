// 中英双语（E 轨）
//   用法：<span data-i18n="panel.title"></span>，切换时调用 applyLang()
//   地名：tName('图书馆') → 'Library'（表在 name-en.js）
//   语言写进 URL（?lang=en），校区切换会一起带上
(function () {
  var DICT = {
    zh: {
      "brand.sub": "GDUFS Wayfinder",
      "campus.south": "南校",
      "campus.north": "北校",
      "panel.title": "广外校园向导",
      "panel.sub": "广东外语外贸大学 · 大学城校区<br>51 栋建筑 · LOD2 模型 · 步行路径规划",
      "panel.sub.north": "广东外语外贸大学 · 白云山校区<br>42 栋建筑 · 官方平面图矢量化",
      "form.from": "起点",
      "form.to": "终点",
      "form.select": "请选择…",
      "btn.labels": "建筑标注",
      "btn.roads": "道路",
      "btn.reset": "重置视角",
      "btn.walk": "走过去看看",
      "legend.teaching": "教学 / 实验",
      "legend.dorm": "学生宿舍",
      "legend.library": "图书馆",
      "legend.canteen": "食堂",
      "legend.sports": "体育场馆",
      "legend.culture": "文化 / 会堂",
      "legend.clinic": "门诊",
      "legend.misc": "其他",
      "hint.body": "左键拖动旋转 · 滚轮缩放 · 右键平移<br>可直接点击建筑设置起点 / 终点。<br>生活区和教学区经 <b>地下隧道</b> 穿行。<br>名称/层数已按官方资料与规划验收合格证修正。",
      "hint.body.north": "左键拖动旋转 · 滚轮缩放 · 右键平移<br>可直接点击建筑查看信息。<br>轮廓来自学校《北校区平面图》矢量化；层数为按类型推定。",
      "ai.name": "语心",
      "ai.input": "问：从文采园怎么去图书馆？",
      "ai.send": "发送",
      "ai.greet": "你好，我是语心 🧭 这里是大学城校区。\n可以问我校园导航、办事流程、楼栋信息。",
      "ai.greet.north": "你好，我是语心 🧭 这里是白云山校区。\n可以问我校园导航、办事流程、楼栋信息。",
      "chip.1": "从文采园怎么去图书馆？",
      "chip.2": "成绩单在哪办？",
      "chip.3": "图书馆几层？",
      "chip.4": "一共有几个校门？",
      "chip.north.1": "从正门怎么去图书馆？",
      "chip.north.2": "成绩单在哪办？",
      "chip.north.3": "相思河在哪？",
      "chip.north.4": "一共有几个校门？",
      "status.pick": "请选择起点和终点（可直接点击画面中的建筑）。",
      "walk.pause": "暂停",
      "walk.exit": "退出漫游",
      "walk.ready": "准备出发"
    },
    en: {
      "brand.sub": "GDUFS Wayfinder",
      "campus.south": "South",
      "campus.north": "North",
      "panel.title": "GDUFS Campus Guide",
      "panel.sub": "Guangdong University of Foreign Studies · Mega Center Campus<br>51 buildings · LOD2 models · walking routes",
      "panel.sub.north": "Guangdong University of Foreign Studies · Baiyunshan Campus<br>42 buildings · vectorised from the official plan",
      "form.from": "From",
      "form.to": "To",
      "form.select": "Select…",
      "btn.labels": "Labels",
      "btn.roads": "Roads",
      "btn.reset": "Reset view",
      "btn.walk": "Walk through",
      "legend.teaching": "Teaching / Lab",
      "legend.dorm": "Dormitory",
      "legend.library": "Library",
      "legend.canteen": "Canteen",
      "legend.sports": "Sports",
      "legend.culture": "Culture / Hall",
      "legend.clinic": "Clinic",
      "legend.misc": "Others",
      "hint.body": "Drag to rotate · scroll to zoom · right-drag to pan<br>Click a building to set start / destination.<br>North and south halves are linked by the <b>underground tunnel</b>.<br>Names and floors verified against official sources.",
      "hint.body.north": "Drag to rotate · scroll to zoom · right-drag to pan<br>Click a building for details.<br>Footprints vectorised from the official campus plan; floors estimated by type.",
      "ai.name": "Yuxin",
      "ai.input": "Ask: how do I get to the library?",
      "ai.send": "Send",
      "ai.greet": "Hi, I'm Yuxin 🧭 You're on the Mega Center Campus.\nAsk me about campus navigation, service procedures or buildings.",
      "ai.greet.north": "Hi, I'm Yuxin 🧭 You're on the Baiyunshan Campus.\nAsk me about campus navigation, service procedures or buildings.",
      "chip.1": "How do I get to the library from Canteen 1?",
      "chip.2": "Where can I get my transcript?",
      "chip.3": "How many floors does the library have?",
      "chip.4": "How many gates are there?",
      "chip.north.1": "How do I get to the library from the Main Gate?",
      "chip.north.2": "Where can I get my transcript?",
      "chip.north.3": "Where is the Xiangsi River?",
      "chip.north.4": "How many gates are there?",
      "status.pick": "Pick a start and a destination (or click a building on the map).",
      "walk.pause": "Pause",
      "walk.exit": "Exit walk",
      "walk.ready": "Ready"
    }
  };

  function detect() {
    var m = /[?&]lang=(en|zh)/.exec(location.search);
    if (m) return m[1];
    try { return localStorage.getItem("gdufs_lang") || "zh"; } catch (e) { return "zh"; }
  }

  var lang = detect();

  function t(key) {
    var d = DICT[lang] || DICT.zh;
    return d[key] != null ? d[key] : (DICT.zh[key] != null ? DICT.zh[key] : key);
  }

  // 地名翻译：英文缺失时退回中文
  function tName(name) {
    if (lang !== "en" || !name) return name;
    var map = window.GDUFS_NAME_EN || {};
    return map[name] || name;
  }

  function applyLang(next) {
    if (next) { lang = next; }
    try { localStorage.setItem("gdufs_lang", lang); } catch (e) { /* 忽略 */ }
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";

    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute("data-i18n");
      var v = t(k);
      if (v.indexOf("<") >= 0) nodes[i].innerHTML = v;
      else nodes[i].textContent = v;
    }
    var phs = document.querySelectorAll("[data-i18n-ph]");
    for (var j = 0; j < phs.length; j++) {
      phs[j].setAttribute("placeholder", t(phs[j].getAttribute("data-i18n-ph")));
    }
    var pills = document.querySelectorAll("#langSwitch button");
    for (var k2 = 0; k2 < pills.length; k2++) {
      pills[k2].classList.toggle("on", pills[k2].getAttribute("data-lang") === lang);
    }
    if (typeof window.__onLangChange === "function") window.__onLangChange(lang);
  }

  window.GDUFS_LANG = { get: function () { return lang; }, t: t, tName: tName, apply: applyLang };
  window.t = t;
  window.tName = tName;

  // 自己负责首次铺文案：单文件版里 i18n.js 被内联到 body 末尾，
  // 页面底部的切换脚本在它之前执行，那时 GDUFS_LANG 还不存在，
  // 靠页面脚本调用 apply 会静默失效（?lang=en 打开仍是中文）。
  function boot() { applyLang(lang); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
