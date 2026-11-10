/* ===========================================================================
   isabellewang.net — work-page footer reveal
   The footer (.site-footer) floats over the scroll region and is hidden by
   default. Scrolling DOWN in <main> reveals it; scrolling UP hides it. At the
   very bottom it stays shown; if the page is too short to scroll it shows too;
   focusing a footer link reveals it. Include on any work page:
       <script src="footer.js"></script>
   =========================================================================== */

(function () {
  "use strict";

  var THRESHOLD = 10;   // ignore scrolls smaller than this (px) — kills trackpad jitter
  var BOTTOM_EPS = 2;   // within this many px of the end counts as "at the bottom"

  function init() {
    var main = document.querySelector("main");
    var footer = document.querySelector(".site-footer");
    if (!main || !footer) return;

    var lastY = main.scrollTop;
    var shown = false;

    function show() {
      if (!shown) { shown = true; footer.classList.add("is-visible"); }
    }
    function hide() {
      // Never hide while a footer link is keyboard-focused.
      if (footer.contains(document.activeElement)) return;
      if (shown) { shown = false; footer.classList.remove("is-visible"); }
    }

    function notScrollable() {
      return main.scrollHeight - main.clientHeight <= BOTTOM_EPS;
    }
    function atBottom() {
      return main.scrollHeight - main.scrollTop - main.clientHeight <= BOTTOM_EPS;
    }

    function update() {
      // Nothing to scroll, or sitting at (or bounced near) the bottom -> keep shown.
      if (notScrollable() || atBottom()) { show(); lastY = main.scrollTop; return; }

      var y = main.scrollTop;
      var delta = y - lastY;
      if (Math.abs(delta) < THRESHOLD) return;   // below threshold: ignore (no flicker)
      if (delta > 0) show(); else hide();
      lastY = y;
    }

    main.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", function () {
      if (notScrollable()) show();
      lastY = main.scrollTop;
    });
    // Keyboard Tab into the footer must reveal it.
    footer.addEventListener("focusin", show);

    // Initial state: hidden, unless there's nothing to scroll.
    if (notScrollable()) show();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
