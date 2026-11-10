/* ===========================================================================
   isabellewang.net — v2 "enter from landing" auto-scroll (experiment)
   After clicking a landing slide into one of ENTRY_PAGES, the work page holds
   on its hero for a moment, then scrolls <main> so the text row sits just
   below the header. Only that click triggers it: landing writes a one-time
   sessionStorage flag, the work page reads and clears it at once. Reload,
   Back/Forward, index, Previous/Next and direct visits find no flag (or a
   stale / mismatched one) and do nothing. No View Transitions needed.

   Include on the landing page (index.html) and on every page listed in ENTRY_PAGES:
       <script src="landing-entry.js"></script>   (end of <body>)
   =========================================================================== */

(function () {
  "use strict";

  /* ---- 可调参数 settings ------------------------------------------------- */

  // 启用此效果的作品页（从首页点击进入时自动滚到正文）。以后只需在这里加页面名
  var ENTRY_PAGES = ["aloe.html", "through_the_stone.html", "melodic_echo_odyssey.html", "vernal_soiree.html", "nike_iwd.html"];

  var PAUSE = 200;      // 停顿时间（毫秒）：进入后先停留在主图上（默认值）

  // 按页面单独设置停顿时间（毫秒），覆盖上面的默认 PAUSE。
  // 写法："页面文件名": 毫秒数；没有写在这里的页面使用默认 PAUSE。
  // 有无缝过渡的页面（Nike），停顿从过渡结束后开始计算。
  var PAGE_PAUSE = {
    "nike_iwd.html": 200,
    "vernal_soiree.html": 850
  };
  var DURATION = 1000;   // 滚动时长（毫秒）
  var OFFSET = 16;       // 文字行顶部距离页眉底部的距离（px）
  var TARGET = ".module-textrow";   // 滚动停在哪个元素（默认主图下方的文字行）
  // 缓动曲线：t 为 0→1 的进度，返回 0→1。默认 easeOutCubic（直接起步、缓慢停下）
  // 备选 easeInOutCubic（缓入缓出）: return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // 备选 easeInOutSine（更柔和）:   return -(Math.cos(Math.PI * t) - 1) / 2;
  function ease(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /* ---------------------------------------------------------------------- */

  var KEY = "landing-entry";   // sessionStorage key
  var MAX_AGE = 10000;          // a flag older than this (ms) is ignored

  function fileOf(url) {
    try { return new URL(url, location.href).pathname.split("/").pop(); }
    catch (e) { return ""; }
  }
  // the landing page is index.html, usually reached as the bare site root ("/")
  function isLanding(file) { return file === "" || file === "index.html"; }
  function store(fn) {          // sessionStorage can throw (private mode, blocked storage)
    try { return fn(window.sessionStorage); } catch (e) { return null; }
  }
  // 手机（≤ 767px）或竖屏（例如 iPad 竖着拿）不执行入场自动滚动，作品页直接停在顶部（和 landing 选竖版素材的条件一致）
  function phone() {
    return window.matchMedia && matchMedia("(max-width: 767px), (orientation: portrait)").matches;
  }

  /* ---- landing: write the flag on a plain click into an ENTRY_PAGES slide */
  if (document.getElementById("slides")) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a.slide");
      if (!a) return;
      var target = fileOf(a.getAttribute("href"));
      // modified clicks (new tab/window) or other slides: no flag
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ||
          ENTRY_PAGES.indexOf(target) === -1 || phone()) {
        store(function (s) { s.removeItem(KEY); });
        return;
      }
      store(function (s) { s.setItem(KEY, JSON.stringify({ page: target, t: Date.now() })); });
    }, true);
    return;
  }

  /* ---- work page: consume the flag ------------------------------------- */
  var page = fileOf(location.href);
  if (ENTRY_PAGES.indexOf(page) === -1) return;

  var raw = store(function (s) { var v = s.getItem(KEY); s.removeItem(KEY); return v; });
  if (!raw) return;
  var flag;
  try { flag = JSON.parse(raw); } catch (e) { return; }

  var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
  var fresh = flag && flag.page === page && Date.now() - flag.t < MAX_AGE;
  var fromLanding = !!document.referrer && isLanding(fileOf(document.referrer));
  var normalLoad = !nav || nav.type === "navigate";       // not reload / back_forward
  if (!fresh || !fromLanding || !normalLoad) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (phone()) return;

  var main = document.querySelector("body > main");
  var target = document.querySelector(TARGET);
  if (!main || !target) return;

  var timer = 0, raf = 0, lastSet = -1, done = false;

  // Only the visitor SCROLLING cancels the pause or stops the animation:
  // wheel / trackpad, a finger swipe (touchmove — a tap is not a swipe),
  // the page-scrolling keys, or dragging the scrollbar. Clicks, taps, mouse
  // movement and other keys leave it running.
  var SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", " ", "Spacebar", "Home", "End"];
  function onKey(e) {
    if (SCROLL_KEYS.indexOf(e.key) !== -1) stop();
  }
  // Any scroll position we didn't set ourselves (scrollbar drag, or a scroll
  // the events above didn't catch). Our own frames move scrollTop to lastSet,
  // so their scroll events match it and are ignored; before the animation
  // starts (lastSet < 0) nothing of ours scrolls, so any change is the visitor's.
  function onScroll() {
    if (lastSet < 0 || Math.abs(main.scrollTop - lastSet) > 2) stop();
  }
  function stop() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    window.removeEventListener("wheel", stop, true);
    window.removeEventListener("touchmove", stop, true);
    window.removeEventListener("keydown", onKey, true);
    main.removeEventListener("scroll", onScroll);
  }
  window.addEventListener("wheel", stop, { capture: true, passive: true });
  window.addEventListener("touchmove", stop, { capture: true, passive: true });
  window.addEventListener("keydown", onKey, true);
  main.addEventListener("scroll", onScroll, { passive: true });

  function run() {
    if (done) return;
    var from = main.scrollTop;
    var to = from + target.getBoundingClientRect().top - main.getBoundingClientRect().top - OFFSET;
    to = Math.max(0, Math.min(to, main.scrollHeight - main.clientHeight));
    var start = 0;
    function frame(now) {
      if (done) return;
      if (!start) start = now;
      var p = Math.min(1, (now - start) / DURATION);
      lastSet = Math.round(from + (to - from) * ease(p));
      main.scrollTop = lastSet;
      lastSet = main.scrollTop;          // what the browser actually applied
      if (p < 1) raf = requestAnimationFrame(frame);
      else stop();
    }
    raf = requestAnimationFrame(frame);
  }

  // The pause starts only after the landing seamless transition (pages that
  // load landing-transition.js, i.e. Nike) has finished; otherwise straight away.
  (window.landingTransitionDone || Promise.resolve()).then(function () {
    var pause = PAGE_PAUSE.hasOwnProperty(page) ? PAGE_PAUSE[page] : PAUSE;
    if (!done) timer = setTimeout(run, pause);
  });
})();
