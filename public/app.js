/* The Real Local Cost — progressive enhancement only.
   Every page works with JavaScript disabled; this only adds the
   small conveniences. */
(function () {
  "use strict";

  /* Copy a number as text, with the currency, for quick sharing. */
  function wireCopyButtons() {
    var nodes = document.querySelectorAll("[data-copy]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener("click", function (ev) {
        var v = ev.currentTarget.getAttribute("data-copy");
        if (!v) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(v).then(function () {
            flash(ev.currentTarget);
          });
        }
      });
    }
  }

  function flash(el) {
    var old = el.getAttribute("data-old") || el.textContent;
    el.setAttribute("data-old", old);
    el.textContent = "✓";
    setTimeout(function () {
      el.textContent = old;
    }, 1200);
  }

  /* Keep the sticky nav honest about where you are. */
  function markActive() {
    var path = location.pathname;
    var links = document.querySelectorAll(".nav-links > a");
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href");
      if (!href || href === "/") continue;
      if (path.indexOf(href) === 0) links[i].classList.add("active");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      wireCopyButtons();
      markActive();
    });
  } else {
    wireCopyButtons();
    markActive();
  }
})();
