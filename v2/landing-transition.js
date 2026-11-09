/* ===========================================================================
   isabellewang.net — v2 landing -> work page "seamless" transition (experiment)
   Cross-document View Transitions: the clicked landing slide's image morphs
   into the work page's top hero image while the header stays put.

   Loaded by landing.html and by each work page that takes part (only
   nike_iwd.html today). Pages opt in with @view-transition in
   landing.css / landing-transition.css; every other page lacks that rule, so
   navigations to or from them never animate.
   =========================================================================== */

(function () {
  "use strict";

  /* 参与过渡的作品页 — work pages whose landing slide morphs into their hero.
     To add another slide later: add its page here, give that page's top image
     id="page-hero", and link landing-transition.css + this script from it. */
  var HERO_PAGES = ["nike_iwd.html"];

  var HERO_NAME = "hero";
  var HEADER_NAME = "site-header";

  function fileOf(url) {
    try { return new URL(url, location.href).pathname.split("/").pop(); }
    catch (e) { return ""; }
  }
  function reducedMotion() {
    return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  // 手机（≤ 767px）不播放无缝过渡，直接打开作品页（与 landing-entry.js 相同的宽度判断）
  function phone() {
    return window.matchMedia && matchMedia("(max-width: 767px)").matches;
  }
  function header() { return document.querySelector(".site-header"); }
  function clearNames() {
    document.querySelectorAll("[data-vt-named]").forEach(function (el) {
      el.style.viewTransitionName = "";
      el.removeAttribute("data-vt-named");
    });
  }
  function name(el, n) {
    el.style.viewTransitionName = n;
    el.setAttribute("data-vt-named", "");
  }
  // Skip without leaving "AbortError: Transition was skipped" in the console.
  function skip(vt) {
    var noop = function () {};
    if (vt.ready) vt.ready.catch(noop);
    if (vt.updateCallbackDone) vt.updateCallbackDone.catch(noop);
    vt.skipTransition();
  }

  // Navigation type and source of the current page load.
  // Navigation API where available (Chrome); otherwise referrer + navigation
  // timing (Safari 18 has View Transitions but no Navigation API).
  // A back/forward-cache restore keeps the original timing type and referrer,
  // so remember it (pageshow fires before pagereveal).
  var restored = false;
  window.addEventListener("pageshow", function (e) { restored = e.persisted; });

  function arrival() {
    var act = window.navigation && navigation.activation;
    if (act) {
      return { type: act.navigationType, from: act.from ? fileOf(act.from.url) : "" };
    }
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    var t = restored ? "back_forward" : (nav ? nav.type : "navigate");   // navigate | reload | back_forward
    return { type: t === "navigate" ? "push" : t, from: document.referrer ? fileOf(document.referrer) : "" };
  }

  /* ---- landing page (old document) ------------------------------------- */
  if (document.getElementById("slides")) {
    var clicked = null;                                 // the slide element actually clicked
    document.addEventListener("click", function (e) {
      clicked = (e.target.closest && e.target.closest("a.slide")) || null;
    }, true);

    // The slide to morph: the clicked one; otherwise (no click recorded) the
    // slide for that page nearest the top of the view. Landing can show the
    // same page twice (its endless-loop copies), so never pick by link alone.
    function slideFor(target) {
      if (clicked && fileOf(clicked.getAttribute("href")) === target) return clicked;
      var best = null, d = Infinity;
      document.querySelectorAll("a.slide").forEach(function (s) {
        if (fileOf(s.getAttribute("href")) !== target) return;
        var dist = Math.abs(s.getBoundingClientRect().top);
        if (dist < d) { d = dist; best = s; }
      });
      return best;
    }

    window.addEventListener("pageswap", function (e) {
      if (!e.viewTransition) return;
      clearNames();
      var act = e.activation;
      var target = act && act.entry ? fileOf(act.entry.url) : (clicked ? fileOf(clicked.getAttribute("href")) : "");
      var push = act ? act.navigationType === "push" : true;
      var slide = HERO_PAGES.indexOf(target) !== -1 && slideFor(target);
      var media = slide && slide.querySelector("img, video");  // absent when the file is missing
      if (!push || !media || reducedMotion() || phone()) { skip(e.viewTransition); return; }
      name(media, HERO_NAME);
      name(header(), HEADER_NAME);
    });

    // Coming back to landing (header link, Back): never animate.
    window.addEventListener("pagereveal", function (e) {
      if (e.viewTransition) skip(e.viewTransition);
    });
    // Restored from the back/forward cache: drop names left from the last swap.
    window.addEventListener("pageshow", clearNames);
    return;
  }

  /* ---- work page (new document) ---------------------------------------- */
  // window.landingTransitionDone: resolves once this page's entrance transition
  // is over (or at once when there is none), so later effects such as
  // landing-entry.js's auto-scroll can start after it instead of overlapping.
  var settle;
  window.landingTransitionDone = new Promise(function (resolve) { settle = resolve; });
  if (!("onpagereveal" in window)) settle();            // no pagereveal (no View Transitions): nothing to wait for

  window.addEventListener("pagereveal", function (e) {
    if (!e.viewTransition) { settle(); return; }        // the other page didn't opt in
    var a = arrival();
    var hero = document.getElementById("page-hero");
    // Only a fresh click from landing animates; reload, Back/Forward, index,
    // Previous/Next and direct visits are skipped.
    if (a.type !== "push" || a.from !== "landing.html" || !hero || reducedMotion() || phone()) {
      skip(e.viewTransition);
      settle();
      return;
    }
    name(hero, HERO_NAME);
    name(header(), HEADER_NAME);
    e.viewTransition.finished.then(clearNames, clearNames).then(settle);
  });

  // Leaving a work page never animates (only landing -> work page does). Skip
  // quietly so a destination that isn't opted in doesn't log an aborted transition.
  window.addEventListener("pageswap", function (e) {
    if (e.viewTransition) skip(e.viewTransition);
  });
})();
