// 第一人称漫游（B7.1）
//   依赖：app.js 暴露的 window.__lastRoute（[[x,z], ...]）与 window.__navDebug（camera / controls）
//   用法：window.__walk.start() / .stop() / .toggle()
//
// 设计要点：
//   - 相机降到 1.65 m（人眼高度），沿折线以 1.4 m/s 前进
//   - 前进方向 = 曲线切线，看向前方 4 m，轻微上下起伏模拟走路
//   - 退出时完整还原进入前的相机位姿，不破坏用户视角
(function () {
  var SPEED = 1.4;          // m/s
  var EYE = 1.65;           // 人眼高度
  var LOOK_AHEAD = 4.0;     // 视线前瞻距离

  var state = null;         // { curve, len, t, raf, saved, dist }
  var bar = null;

  function nav() { return window.__navDebug; }

  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "walkbar";
    bar.innerHTML =
      '<button id="walk-pause" title="暂停/继续">⏸</button>' +
      '<span id="walk-info">准备出发</span>' +
      '<span id="walk-progress"><i></i></span>' +
      '<button id="walk-exit" title="退出漫游（Esc）">✕</button>';
    document.body.appendChild(bar);

    bar.querySelector("#walk-pause").addEventListener("click", function () {
      if (!state) return;
      state.paused = !state.paused;
      this.textContent = state.paused ? "▶" : "⏸";
    });
    bar.querySelector("#walk-exit").addEventListener("click", stop);
    return bar;
  }

  function setInfo(text) {
    var el = document.querySelector("#walk-info");
    if (el) el.textContent = text;
  }

  function setProgress(ratio) {
    var el = document.querySelector("#walk-progress i");
    if (el) el.style.width = Math.max(0, Math.min(1, ratio)) * 100 + "%";
  }

  function setBoundaryVisible(v) {
    var n = nav();
    if (!n) return;
    // 漫游时隐藏所有装饰线（边界、岸线、场地轮廓），它们在贴地视角会变成横贯画面的白线
    n.scene.traverse(function (o) {
      if (o.isLine && o.name !== "routeLine") o.visible = v;
    });
  }

  function start() {
    var pts = window.__lastRoute;
    var n = nav();
    if (!n) { console.warn("[walk] __navDebug 未就绪"); return false; }
    if (!pts || pts.length < 2) {
      setInfoTemporary("先选起点和终点，规划一条路线");
      return false;
    }
    if (state) stop();
    ensureBar();

    var v3 = pts.map(function (p) {
      return new THREE.Vector3(p[0], EYE, p[1]);
    });
    var curve = new THREE.CatmullRomCurve3(v3, false, "catmullrom", 0.4);
    var len = curve.getLength();

    state = {
      curve: curve,
      len: len,
      s: 0,                       // 已走距离（米）
      raf: 0,
      paused: false,
      saved: {
        pos: n.camera.position.clone(),
        target: n.controls.target.clone()
      }
    };

    var cam = n.camera;
    var controls = n.controls;
    controls.enabled = false;
    window.__walkActive = true;
    setBoundaryVisible(false);
    document.body.classList.add("walking");
    if (bar) bar.classList.add("on");

    var last = performance.now();
    var tmpA = new THREE.Vector3();
    var tmpB = new THREE.Vector3();

    function frame(now) {
      if (!state) return;
      var dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;

      if (!state.paused) {
        state.s = Math.min(state.len, state.s + SPEED * dt);
        if (state.s >= state.len) {
          setInfo("到达目的地 · 全程 " + Math.round(state.len) + " 米");
          setProgress(1);
          stop(true);
          return;
        }
      }

      var t = Math.max(0, Math.min(1, state.s / state.len));
      state.curve.getPointAt(t, tmpA);
      var t2 = Math.max(0, Math.min(1, (state.s + LOOK_AHEAD) / state.len));
      state.curve.getPointAt(t2, tmpB);

      // 走路起伏
      var bob = Math.sin(state.s * 2.4) * 0.035;
      cam.position.set(tmpA.x, EYE + bob, tmpA.z);
      cam.lookAt(tmpB.x, EYE + bob * 0.6, tmpB.z);

      setProgress(t);
      setInfo(
        (state.paused ? "已暂停 · " : "步行中 · ") +
        Math.round(state.s) + " / " + Math.round(state.len) + " 米 · 约 " +
        Math.max(1, Math.round((state.len - state.s) / SPEED / 60)) + " 分钟"
      );

      state.raf = requestAnimationFrame(frame);
    }

    state.raf = requestAnimationFrame(frame);
    return true;
  }

  function setInfoTemporary(text) {
    ensureBar();
    bar.classList.add("on");
    setInfo(text);
    clearTimeout(setInfoTemporary._t);
    setInfoTemporary._t = setTimeout(function () {
      if (!state && bar) bar.classList.remove("on");
    }, 2600);
  }

  function stop(silent) {
    var n = nav();
    if (state) {
      cancelAnimationFrame(state.raf);
      if (n && state.saved) {
        n.camera.position.copy(state.saved.pos);
        n.controls.target.copy(state.saved.target);
        n.controls.update();
      }
      state = null;
    }
    if (n) n.controls.enabled = true;
    window.__walkActive = false;
    setBoundaryVisible(true);
    document.body.classList.remove("walking");
    if (bar) bar.classList.remove("on");
    var b = document.getElementById("btnWalk");
    if (b) b.classList.remove("on");
    if (!silent) setProgress(0);
  }

  function toggle() {
    if (state) { stop(); return false; }
    return start();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && state) stop();
  });

  window.__walk = {
    start: start, stop: stop, toggle: toggle,
    isOn: function () { return !!state; },
    _s: function () { return state ? state.s : -1; }
  };

  // 面板按钮绑定（index.html 里的「走过去看看」）
  var btn = document.getElementById("btnWalk");
  if (btn) {
    btn.addEventListener("click", function () {
      if (state) { stop(); btn.classList.remove("on"); }
      else if (start()) { btn.classList.add("on"); }
    });
  }
})();
