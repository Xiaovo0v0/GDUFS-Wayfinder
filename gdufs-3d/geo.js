/**
 * 定位「我现在在哪」
 *   浏览器 Geolocation（WGS84）→ 校园本地坐标 → 交给 app.js 的 setMyPosition
 *
 * 坐标系：与建筑/路网同一套（见 gdufs-data.js 的 meta）
 *   x = 西向为正（镜像），z = 北向为正，单位米
 *   x = -(lon - lon0) * 111320 * cos(lat0)
 *   z = (lat - lat0) * 110540
 *
 * 前提：
 *   - 南校区已配准（meta.origin_wgs84）；北校区按官方平面图矢量化，没有经纬度，按钮不可用
 *   - 定位 API 只在「安全上下文」可用：HTTPS / localhost / file://（双击本地 HTML 可以）
 *     手机用局域网 IP 的 http://192.168.x.x 打开会被浏览器拦掉，演示要换成 HTTPS 或隧道
 *
 * 调试参数：
 *   ?ll=23.0665,113.3921[,20]   直接喂一个坐标（没有 GPS 的笔记本演示/截图用）
 *   ?geo=gcj                    手机返回的是高德（GCJ-02）坐标时，先反算成 WGS84 再投影
 */
(function () {
  "use strict";

  var EN = window.GDUFS_LANG && window.GDUFS_LANG.get() === "en";
  // 南北校区各有一套数据：北校按官方平面图矢量化，meta.origin_wgs84 为 null（没有经纬度）
  var CAMPUS = (function () {
    var m = /[?&]campus=(north|south)/.exec(location.search);
    return m ? m[1] : "south";
  })();
  var D = (CAMPUS === "north" && window.GDUFS_NORTH) ? window.GDUFS_NORTH : window.GDUFS_DATA;
  var META = D && D.meta;
  var ORIGIN = META && META.origin_wgs84;

  var KZ = 110540;                                             // 每度纬度 ≈ 110.54 km
  var KX = ORIGIN ? 111320 * Math.cos(ORIGIN.lat * Math.PI / 180) : 0;  // 每度经度

  // ---------------- 投影 ----------------
  function project(lat, lon) {
    return { x: -(lon - ORIGIN.lon) * KX, z: (lat - ORIGIN.lat) * KZ };
  }
  function unproject(x, z) {
    return { lon: ORIGIN.lon - x / KX, lat: ORIGIN.lat + z / KZ };
  }

  // ---------------- 火星坐标（GCJ-02） ----------------
  // 规范上 navigator.geolocation 返回 WGS84，但部分国产浏览器/WebView 直接给高德坐标，
  // 在广州会偏 400–500 m——足以把「图书馆门口」定位到校外。
  var PI = Math.PI, AA = 6378245.0, EE = 0.00669342162296594323;
  var mDatum = /[?&]geo=(gcj02|gcj|wgs84|wgs)/i.exec(location.search);
  var DATUM = mDatum ? (/^gcj/i.test(mDatum[1]) ? "gcj02" : "wgs84") : "wgs84";

  function outOfChina(lat, lon) {
    return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }
  function tLat(x, y) {
    var r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
    return r;
  }
  function tLon(x, y) {
    var r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
    return r;
  }
  function wgs2gcj(lat, lon) {
    if (outOfChina(lat, lon)) { return { lat: lat, lon: lon }; }
    var dLat = tLat(lon - 105, lat - 35);
    var dLon = tLon(lon - 105, lat - 35);
    var radLat = lat / 180 * PI;
    var magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    var sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180) / ((AA * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLon = (dLon * 180) / (AA / sqrtMagic * Math.cos(radLat) * PI);
    return { lat: lat + dLat, lon: lon + dLon };
  }
  function gcj2wgs(lat, lon) {
    // 一阶反解：误差 < 1 m，对步行导航足够
    var g = wgs2gcj(lat, lon);
    return { lat: lat * 2 - g.lat, lon: lon * 2 - g.lon };
  }

  // ---------------- 文案 ----------------
  var TEXT = {
    zh: {
      locating: "正在定位…（首次定位通常 5–15 秒）",
      slow: "还在定位…室内或地下车库收不到 GPS，到窗边/室外会快很多",
      nohttps: "拿不到定位：浏览器的定位只在 HTTPS 或本机页面（file://、localhost）可用。用局域网 IP 的 http 地址打开会被拦。",
      nolocate: "这个浏览器没有定位能力（navigator.geolocation 不存在）。",
      north: "北校区地图按官方平面图矢量化，还没配到经纬度，暂不支持定位。",
      denied: "定位权限被拒绝：点地址栏左侧图标 → 允许「位置」，再点一次「我的位置」。",
      unavailable: "拿不到位置：系统定位关着，或附近没有 GPS/基站信息。",
      timeout: "定位超时，到室外再试一次。",
      outside: "定位点在校界外约 {d} 米——若明显不对，可能手机给的是高德坐标，加 ?geo=gcj 再试。",
      clear: "✕ 取消定位"
    },
    en: {
      locating: "Locating… (the first fix usually takes 5–15 s)",
      slow: "Still locating… indoors or underground you may not get a GPS fix; try near a window.",
      nohttps: "No location: the Geolocation API only works on HTTPS or local pages (file://, localhost). Opening over a LAN http:// address is blocked.",
      nolocate: "This browser has no geolocation support.",
      north: "The Baiyunshan campus map is vectorised from the official plan and is not georeferenced yet, so positioning is unavailable.",
      denied: "Location permission denied. Allow “Location” from the address-bar icon and try again.",
      unavailable: "Position unavailable: system location may be off, or there is no GPS/cell data.",
      timeout: "Locating timed out. Try again outdoors.",
      outside: "The fix is about {d} m outside the campus boundary. If that is clearly wrong, the device may report GCJ-02 coordinates — add ?geo=gcj.",
      clear: "✕ Clear"
    }
  };
  function msg(key, arg) {
    var s = (TEXT[EN ? "en" : "zh"][key]) || key;
    return String(s).replace("{d}", arg == null ? "" : arg);
  }

  // ---------------- 状态栏 ----------------
  function statusEl() { return document.getElementById("status"); }
  function say(html) {
    var s = statusEl();
    if (s) { s.innerHTML = '<span class="warn">' + html + '</span>'; }
  }
  function appendWarn(html) {
    var s = statusEl();
    if (s) { s.innerHTML += '<br><span class="warn">' + html + '</span>'; }
  }

  // ---------------- 应用一次定位 ----------------
  var lastFix = null;
  function applyFix(lat, lon, acc, heading) {
    if (!ORIGIN) { say(msg("north")); return null; }
    if (!window.__navDebug || !window.__navDebug.setMyPosition) { return null; }
    if (!isFinite(lat) || !isFinite(lon)) { return null; }

    var w = DATUM === "gcj02" ? gcj2wgs(+lat, +lon) : { lat: +lat, lon: +lon };
    var p = project(w.lat, w.lon);
    var info = window.__navDebug.setMyPosition(p.x, p.z, {
      accuracy: acc, lat: w.lat, lon: w.lon, heading: heading
    });
    if (!info) { return null; }
    lastFix = { lat: w.lat, lon: w.lon, accuracy: acc, x: p.x, z: p.z, at: Date.now() };

    // 校界检查：明显落在校外的定位，先说清楚，别让人以为地图坏了
    var b = META && META.bounds_m;
    if (b) {
      var dx = Math.max(b.x[0] - p.x, 0, p.x - b.x[1]);
      var dz = Math.max(b.z[0] - p.z, 0, p.z - b.z[1]);
      var out = Math.hypot(dx, dz);
      if (out > 80) { appendWarn(msg("outside", Math.round(out))); }
    }
    return info;
  }

  // ---------------- 按钮 ----------------
  var btn = document.getElementById("btnLocate");
  function setBtn(on) {
    if (!btn) { return; }
    btn.classList.toggle("on", !!on);
    btn.textContent = on ? msg("clear") : (window.t ? window.t("btn.locate") : "◎ 我的位置");
    btn.title = on ? (EN ? "Click to clear the location" : "再点一次取消定位") : "";
  }

  // ---------------- watchPosition ----------------
  var watchId = null;
  var slowTimer = null;
  var lastApply = 0;
  var lastAcc = 999;

  function onOk(pos) {
    var c = pos.coords || {};
    var now = Date.now();
    // 1.2 秒内的重复回调只接受"更准"的那次，避免标记在两个点之间乱跳
    if (now - lastApply < 1200 && !(c.accuracy && c.accuracy < lastAcc - 5)) { return; }
    lastApply = now;
    lastAcc = c.accuracy || lastAcc;

    var info = applyFix(c.latitude, c.longitude, c.accuracy, c.heading);
    if (info) {
      if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    }
  }

  function onErr(err) {
    var code = err && err.code;
    if (code === 1) { say(msg("denied")); stop(false); return; }
    if (code === 3) { say(msg("timeout")); return; }
    say(msg("unavailable"));
  }

  function start() {
    if (!ORIGIN) { say(msg("north")); return false; }
    if (!navigator.geolocation) { say(msg("nolocate")); return false; }
    if (!window.isSecureContext) { say(msg("nohttps")); return false; }

    setBtn(true);
    say(msg("locating"));
    lastAcc = 999;
    lastApply = 0;
    watchId = navigator.geolocation.watchPosition(onOk, onErr, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 3000
    });
    if (slowTimer) { clearTimeout(slowTimer); }
    slowTimer = setTimeout(function () {
      if (watchId != null && !lastFix) { say(msg("slow")); }
    }, 15000);
    return true;
  }

  function stop(clearMarker) {
    if (watchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    setBtn(false);
    if (clearMarker === true && window.__navDebug && window.__navDebug.clearMyPosition) {
      window.__navDebug.clearMyPosition();
    }
  }

  if (btn) {
    btn.addEventListener("click", function () {
      // 正在跟 / 已有定位结果 → 取消并清掉标记；否则开始定位
      if (watchId != null || lastFix) { lastFix = null; stop(true); return; }
      start();
    });
    if (!ORIGIN) {
      btn.title = msg("north");
      btn.style.opacity = "0.55";
      btn.style.cursor = "not-allowed";
    }
  }

  // ---------------- 调试入口：?ll=lat,lng[,acc] ----------------
  var mLL = /[?&]ll=(-?[0-9.]+),(-?[0-9.]+)(?:,([0-9.]+))?/.exec(location.search);
  if (mLL && ORIGIN) {
    setTimeout(function () {
      applyFix(parseFloat(mLL[1]), parseFloat(mLL[2]), mLL[3] ? parseFloat(mLL[3]) : 25);
    }, 500);
  }

  window.__navGeo = {
    project: project,
    unproject: unproject,
    datum: DATUM,
    origin: ORIGIN,
    fix: applyFix,                 // 直接喂经纬度（测试 / 无 GPS 演示）
    start: start,
    stop: stop,
    state: function () {
      return { on: watchId != null, fix: lastFix, message: msg };
    }
  };
})();
