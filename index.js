/* ===========================================================================
   isabellewang.net — v2 index
   Loads index-content.md, parses its markdown tables, and renders the work
   list. Add/remove/reorder works by editing index-content.md only.
   =========================================================================== */

(function () {
  "use strict";

  var CONTENT_FILE = "index-content.md";
  var THUMB_BASE = "assets/thumbnails/";

  var root = getComputedStyle(document.documentElement);
  // Fall back to 20 only when the value can't be read (NaN), so an explicit 0 is honored.
  function readOffset(name) {
    var v = parseInt(root.getPropertyValue(name), 10);
    return isNaN(v) ? 20 : v;
  }
  var OFFSET_X = readOffset("--thumb-offset-x");

  // Devices without hover (phones, tablets): no thumbnail, a tap just opens the
  // link. Read at each event, so a tablet with a mouse attached still gets it.
  var NO_HOVER = window.matchMedia ? window.matchMedia("(hover: none)") : null;

  /* ---- markdown parsing -------------------------------------------------- */

  // Split a markdown table row into trimmed cells, dropping the outer pipes.
  function splitRow(line) {
    var parts = line.trim().split("|");
    if (parts.length && parts[0].trim() === "") parts.shift();
    if (parts.length && parts[parts.length - 1].trim() === "") parts.pop();
    return parts.map(function (s) { return s.trim(); });
  }

  // Is this the |---|---| separator row?
  function isSeparatorRow(cells) {
    return cells.length > 0 && cells.every(function (c) {
      return /^:?-+:?$/.test(c);
    });
  }

  // Parse the whole file into
  //   [{ name, headerYear, headerTags, items: [{title,year,tags,link,thumbnail}] }].
  // Data cells are read by COLUMN POSITION; the header row's text is kept only
  // for display, so renaming a header in the md never affects the content.
  function parseSections(text) {
    var lines = text.split(/\r?\n/);
    var sections = [];
    var current = null;
    var tableBuf = [];

    function flushTable() {
      if (!current || tableBuf.length === 0) { tableBuf = []; return; }

      // Drop separator rows; first remaining row is the header.
      var rows = tableBuf.filter(function (cells) { return !isSeparatorRow(cells); });
      tableBuf = [];
      if (rows.length < 2) return; // header only (or empty) -> no items

      // Columns are read by POSITION, not by header name:
      //   0 = Title, 1 = Year, 2 = Tags, 3 = Link, 4 = Thumbnail
      // Keep the header row's text only for display (see render()).
      var headerCells = rows[0];
      current.headerYear = headerCells.length > 1 ? headerCells[1] : "";
      current.headerTags = headerCells.length > 2 ? headerCells[2] : "";

      for (var i = 1; i < rows.length; i++) {
        var cells = rows[i];
        var at = function (n) { return (n < cells.length) ? cells[n] : ""; };
        var item = {
          title: at(0),
          year: at(1),
          tags: at(2),
          link: at(3),
          thumbnail: at(4)
        };
        // Skip fully blank rows.
        if (item.title || item.year || item.tags || item.link || item.thumbnail) {
          current.items.push(item);
        }
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var heading = line.match(/^##\s+(.+?)\s*$/);
      if (heading) {
        flushTable();
        current = { name: heading[1], items: [] };
        sections.push(current);
        continue;
      }
      if (line.trim().charAt(0) === "|") {
        tableBuf.push(splitRow(line));
      } else {
        flushTable();
      }
    }
    flushTable();

    // Only keep sections that actually have a table with items.
    return sections.filter(function (s) { return s.items.length > 0; });
  }

  /* ---- rendering --------------------------------------------------------- */

  function makeCell(text, extraClass) {
    var el = document.createElement("div");
    el.className = "cell " + extraClass;
    el.textContent = text || "";
    return el;
  }

  function makeRowInner(titleText, yearText, tagsText) {
    var inner = document.createElement("div");
    inner.className = "row-inner";
    inner.appendChild(makeCell(titleText, "cell-title"));
    inner.appendChild(makeCell(yearText, "cell-year"));
    inner.appendChild(makeCell(tagsText, "cell-tags"));
    return inner;
  }

  function render(sections) {
    var content = document.getElementById("content");
    content.textContent = "";

    sections.forEach(function (section) {
      var sectionEl = document.createElement("section");
      sectionEl.className = "section";

      // Header row: section name + the md's Year/Tags header text (no hover,
      // not clickable). Uppercasing is handled in CSS (.row-head .cell).
      var head = document.createElement("div");
      head.className = "row row-head";
      head.appendChild(makeRowInner(section.name, section.headerYear, section.headerTags));
      sectionEl.appendChild(head);

      // Data rows.
      section.items.forEach(function (item) {
        var row = document.createElement("div");
        row.className = "row row-item";
        if (item.link) {
          row.classList.add("is-link");
          row.setAttribute("data-link", item.link);
        }
        if (item.thumbnail) {
          row.setAttribute("data-thumb", item.thumbnail);
        }
        row.appendChild(makeRowInner(item.title, item.year, item.tags));
        sectionEl.appendChild(row);
      });

      content.appendChild(sectionEl);
    });

    wireInteractions();
  }

  /* ---- interactions ------------------------------------------------------ */

  function wireInteractions() {
    var thumb = document.getElementById("thumb");
    var activeRow = null;
    var lastX = 0, lastY = 0;   // latest pointer position (for positioning on image load)

    function hideThumb() {
      thumb.style.display = "none";
      thumb.removeAttribute("src");
      thumb.removeAttribute("srcset");
    }

    function positionThumb(clientX, clientY) {
      var w = thumb.offsetWidth;
      var h = thumb.offsetHeight;   // displayed size (2x image halved) incl. border
      // Horizontal: offset to the right of the cursor; flip to the left near the
      // right edge (unchanged behaviour).
      var x = clientX + OFFSET_X;
      if (x + w > window.innerWidth) x = clientX - OFFSET_X - w;
      if (x < 0) x = 0;
      // Vertical: centre the thumbnail on the cursor (up by half its displayed
      // height), then clamp inside the window instead of flipping.
      var y = clientY - h / 2;
      if (y + h > window.innerHeight) y = window.innerHeight - h;
      if (y < 0) y = 0;
      thumb.style.left = x + "px";
      thumb.style.top = y + "px";
    }

    /* ---- touch feedback (devices without hover) ------------------------
       A finger on a row shows the desktop hover bar: index.js toggles
       .is-pressed (styled in styles.css). Done in JS rather than with :active,
       which iOS Safari only applies with a touch listener and which behaves
       differently across browsers. Moving the finger (scrolling) drops it. */
    var MOVE_TOLERANCE = 10;    // px a finger may move before it counts as a scroll
    var pressed = null, startX = 0, startY = 0, releaseTimer = 0, leaving = false;

    function noHover() { return !!(NO_HOVER && NO_HOVER.matches); }
    function press(row) {
      clearTimeout(releaseTimer);
      if (pressed && pressed !== row) pressed.classList.remove("is-pressed");
      pressed = row;
      row.classList.add("is-pressed");
    }
    function release() {
      clearTimeout(releaseTimer);
      if (pressed) pressed.classList.remove("is-pressed");
      pressed = null;
    }
    // --row-press-delay (styles.css): how long the bar shows before the jump, max 150ms.
    function pressDelay() {
      var v = getComputedStyle(document.documentElement).getPropertyValue("--row-press-delay").trim();
      var ms = /ms$/.test(v) ? parseFloat(v) : (/s$/.test(v) ? parseFloat(v) * 1000 : parseFloat(v));
      return isNaN(ms) ? 0 : Math.max(0, Math.min(ms, 150));
    }

    document.addEventListener("touchmove", function (e) {
      if (!pressed || !e.touches.length) return;
      var t = e.touches[0];
      if (Math.abs(t.clientX - startX) > MOVE_TOLERANCE || Math.abs(t.clientY - startY) > MOVE_TOLERANCE) release();
    }, { passive: true });
    document.addEventListener("touchcancel", release, { passive: true });
    // No click after lifting the finger (e.g. a long press): drop the bar.
    document.addEventListener("touchend", function () {
      if (pressed && !leaving) releaseTimer = setTimeout(release, 600);
    }, { passive: true });
    var scroller = document.getElementById("content");
    if (scroller) scroller.addEventListener("scroll", function () { if (!leaving) release(); }, { passive: true });
    // Back from a work page (back/forward cache): no leftover bar.
    window.addEventListener("pageshow", function () { leaving = false; release(); });

    var rows = document.querySelectorAll(".row-item");
    rows.forEach(function (row) {
      row.addEventListener("touchstart", function (e) {
        if (!noHover() || !e.touches.length) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        press(row);
      }, { passive: true });

      var link = row.getAttribute("data-link");
      var thumbName = row.getAttribute("data-thumb");

      row.addEventListener("mouseenter", function (e) {
        activeRow = row;
        lastX = e.clientX;
        lastY = e.clientY;
        if (!thumbName || (NO_HOVER && NO_HOVER.matches)) { hideThumb(); return; }
        // Load the thumbnail; reveal only once it has loaded, hide on error.
        // Treat the file as a 2x export via a single "2x" srcset candidate (and no
        // competing `src`), so it always lays out at half its pixel size on any
        // display. positionThumb() then uses the rendered (halved) offset size.
        thumb.onload = function () {
          if (activeRow !== row) return;
          // Show first so it has layout, then position with the real offsetHeight
          // (one synchronous paint -> no zero-height jump on first hover).
          thumb.style.display = "block";
          positionThumb(lastX, lastY);
        };
        thumb.onerror = function () { hideThumb(); };
        thumb.style.display = "none";
        thumb.removeAttribute("src");
        thumb.srcset = THUMB_BASE + thumbName + " 2x";
      });

      row.addEventListener("mousemove", function (e) {
        lastX = e.clientX;
        lastY = e.clientY;
        if (thumb.style.display === "block") positionThumb(lastX, lastY);
      });

      row.addEventListener("mouseleave", function () {
        activeRow = null;
        hideThumb();
      });

      if (link) {
        row.addEventListener("click", function () {
          if (!noHover()) { window.location.href = link; return; }
          // touch: show the bar for --row-press-delay, then open the page
          if (leaving) return;
          leaving = true;
          press(row);
          setTimeout(function () { window.location.href = link; }, pressDelay());
        });
      }
    });
  }

  /* ---- boot -------------------------------------------------------------- */

  function showError(msg) {
    var content = document.getElementById("content");
    var p = document.createElement("p");
    p.style.padding = "0 var(--content-margin)";
    p.textContent = msg;
    content.appendChild(p);
  }

  fetch(CONTENT_FILE, { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      render(parseSections(text));
    })
    .catch(function (err) {
      // Surface a quiet message rather than throwing; nothing else breaks.
      showError("Could not load " + CONTENT_FILE + " (" + err.message + ").");
    });
})();
