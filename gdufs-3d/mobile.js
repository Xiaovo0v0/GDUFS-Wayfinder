/**
 * 手机端适配（≤760px，与 index.html 的媒体查询同一条断点）
 *   1. 底部抽屉可收起：收起后只留标题 + 一行摘要，把主要视野让给地图
 *   2. 摘要跟着起终点、路线距离、定位报错更新，收起状态也能看到关键信息
 *   3. 建筑信息卡出现时先收起图例，两张卡片叠起来会挤掉地图
 *   4. iOS 软键盘：visualViewport 收缩时把底部抽屉与语心浮层抬到键盘上方
 * 桌面端这些逻辑全部空转，不改变原有布局。
 */
(function () {
  "use strict";

  var mq = window.matchMedia("(max-width: 760px)");
  function phoneLayout() { return mq.matches; }
  function T(key, fallback) { return window.t ? window.t(key) : fallback; }

  var panel = document.getElementById("panel");
  var head = document.getElementById("panelHead");
  var toggle = document.getElementById("panelToggle");
  var collapseBtn = document.getElementById("panelCollapse");
  var mini = document.getElementById("miniSummary");
  var bcard = document.getElementById("bcard");
  var statusEl = document.getElementById("status");
  var startSel = document.getElementById("startSelect");
  var endSel = document.getElementById("endSelect");
  // 上/下滑手势之后浏览器还会补一个 click，用它把这次 click 吞掉
  var suppressClickUntil = 0, touchY = null;

  // ---------------- 图例 / 说明 折叠 ----------------
  function setExpanded(on) {
    if (!panel) { return; }
    panel.classList.toggle("expanded", !!on);
    if (toggle) { toggle.setAttribute("aria-expanded", on ? "true" : "false"); }
  }

  if (toggle) {
    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      if (Date.now() < suppressClickUntil) { return; }
      setExpanded(!panel.classList.contains("expanded"));
    });
  }

  // ---------------- 整块面板 收起 / 展开 ----------------
  function isCollapsed() { return !!(panel && panel.classList.contains("collapsed")); }

  function setCollapsed(on) {
    if (!panel) { return; }
    panel.classList.toggle("collapsed", !!on);
    if (collapseBtn) {
      collapseBtn.setAttribute("aria-expanded", on ? "false" : "true");
      var label = on ? T("sheet.expand", "展开") : T("sheet.collapse", "收起");
      collapseBtn.setAttribute("aria-label", label);
      collapseBtn.setAttribute("title", label);
    }
    if (on) {
      // 收起时把图例也复位，下次展开保持紧凑
      setExpanded(false);
      updateMini();
    }
  }

  if (collapseBtn) {
    collapseBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (Date.now() < suppressClickUntil || !phoneLayout()) { return; }
      setCollapsed(!isCollapsed());
    });
  }

  // 点标题 / 摘要整行也能展开收起；上滑展开、下滑收起
  if (head) {
    head.addEventListener("click", function (e) {
      if (Date.now() < suppressClickUntil) { return; }
      if (!phoneLayout() || e.target.closest("button")) { return; }
      setCollapsed(!isCollapsed());
    });
    head.addEventListener("touchstart", function (e) {
      if (!phoneLayout() || e.touches.length !== 1) { return; }
      touchY = e.touches[0].clientY;
    }, { passive: true });
    head.addEventListener("touchend", function (e) {
      if (touchY == null) { return; }
      var dy = e.changedTouches[0].clientY - touchY;
      touchY = null;
      if (!phoneLayout() || Math.abs(dy) < 36) { return; }
      suppressClickUntil = Date.now() + 500;
      setCollapsed(dy > 0);
    });
  }

  // ---------------- 收起态摘要 ----------------
  function optionText(sel) {
    if (!sel || sel.selectedIndex < 0 || sel.value === "-1") { return ""; }
    var o = sel.options[sel.selectedIndex];
    return o ? o.textContent : "";
  }

  function updateMini() {
    if (!mini) { return; }
    var from = optionText(startSel);
    var to = optionText(endSel);
    var warn = statusEl ? statusEl.querySelector(".warn") : null;
    var text = "";
    var bad = false;

    if (from && to) {
      text = from + " → " + to;
      // 距离优先读 #status[data-dist]（app.js setStatus 的第二个参数写的结构化副本）。
      // 正则只是兜底：它依赖票据 HTML 里「1234 米」的字面写法，改一句文案就静默失效。
      var dv = statusEl && statusEl.dataset ? statusEl.dataset.dist : "";
      // 中文「820 米」后面是空格，米不是 \w，不能加 \b
      var m = (/^\d+$/.test(dv || "") ? [dv, dv, "米"] : null) ||
        /([\d,]+)\s*(米|m)/i.exec(statusEl ? statusEl.textContent : "");
      if (m) {
        text += " · " + T("mini.about", "约") + " " + m[1] + " " +
          (m[2].toLowerCase() === "m" ? "m" : T("mini.meter", "米"));
      }
    } else if (from) {
      text = T("mini.from", "起点：") + from + " · " + T("mini.pickEnd", "再选终点");
    } else if (to) {
      text = T("mini.to", "终点：") + to + " · " + T("mini.pickStart", "再选起点");
    } else if (warn) {
      text = "⚠ " + warn.textContent.trim();
      bad = true;
    } else {
      text = T("mini.hint", "点这里展开，选起点和终点");
    }

    mini.textContent = text;
    mini.classList.toggle("warn", bad);
  }

  // 状态栏由 app.js / geo.js 直接写 innerHTML，监听它比散落着改每个入口可靠
  if (statusEl && window.MutationObserver) {
    new MutationObserver(updateMini).observe(statusEl, {
      childList: true, subtree: true, characterData: true
    });
  }
  function onSelectChange() { setTimeout(updateMini, 0); }
  if (startSel) { startSel.addEventListener("change", onSelectChange); }
  if (endSel) { endSel.addEventListener("change", onSelectChange); }

  // ---------------- 建筑信息卡让位 ----------------
  if (bcard && window.MutationObserver) {
    var syncCard = function () {
      // 卡片展开时先把图例收起来，两张卡片叠在一起会挤掉地图
      if (!bcard.classList.contains("hidden")) { setExpanded(false); }
    };
    new MutationObserver(syncCard).observe(bcard, { attributes: true, attributeFilter: ["class"] });
  }

  // ---------------- 软键盘避让 ----------------
  if (window.visualViewport) {
    var vv = window.visualViewport;
    var syncKeyboard = function () {
      // 键盘高度 = 布局视口高度 - 可视区域高度（再减去可视区域顶部偏移）
      var kb = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      document.documentElement.style.setProperty("--kb", Math.round(kb) + "px");
    };
    vv.addEventListener("resize", syncKeyboard);
    vv.addEventListener("scroll", syncKeyboard);
    syncKeyboard();
  }

  // ---------------- 切换宽度时还原 ----------------
  function onLayoutChange() {
    if (phoneLayout()) {
      // 手机默认收起，地图占主视野
      setCollapsed(true);
      return;
    }
    setCollapsed(false);
    setExpanded(false);
    document.body.classList.remove("ai-open");
    var ai = document.getElementById("ai");
    if (ai) { ai.classList.remove("open"); }
    document.documentElement.style.removeProperty("--kb");
  }
  if (mq.addEventListener) { mq.addEventListener("change", onLayoutChange); }
  else if (mq.addListener) { mq.addListener(onLayoutChange); }

  // 首屏：手机端默认收起
  if (phoneLayout()) { setCollapsed(true); }
  updateMini();

  // 给截图/验收脚本留个只读入口
  window.__mobileUI = {
    isPhone: phoneLayout,
    collapsed: isCollapsed,
    expanded: function () { return !!(panel && panel.classList.contains("expanded")); },
    setCollapsed: setCollapsed,
    setExpanded: setExpanded
  };
})();
