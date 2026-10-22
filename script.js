/* Waleed Khan Agency: one small enhancement.
   The sliding showcase under the hero headline. It is skipped for people who
   prefer reduced motion, and the page reads correctly without JavaScript. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Header: flat at the top, glass capsule once the page is scrolled.
  var header = document.querySelector(".site-header");
  if (header) {
    var ticking = false;
    var update = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 40);
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }


  // Menu: a grey pill follows the cursor, a black pill slides to the page you open.
  var nav = document.querySelector(".nav");
  if (nav) {
    var links = Array.prototype.slice.call(nav.querySelectorAll("a"));
    var hoverPill = document.createElement("span");
    var curPill = document.createElement("span");
    hoverPill.className = "nav-pill is-hover";
    curPill.className = "nav-pill is-current";
    hoverPill.setAttribute("aria-hidden", "true");
    curPill.setAttribute("aria-hidden", "true");
    nav.insertBefore(curPill, nav.firstChild);
    nav.insertBefore(hoverPill, nav.firstChild);
    nav.classList.add("has-pills");

    var place = function (pill, link, instant) {
      if (instant) pill.classList.add("no-anim");
      pill.style.width = link.offsetWidth + "px";
      pill.style.height = link.offsetHeight + "px";
      pill.style.transform = "translate(" + link.offsetLeft + "px," + link.offsetTop + "px)";
      if (instant) { void pill.offsetWidth; pill.classList.remove("no-anim"); }
    };
    var current = nav.querySelector('a[aria-current="page"]');
    var setCurrent = function (link, instant) {
      links.forEach(function (l) { l.classList.toggle("is-active", l === link); });
      place(curPill, link, instant);
      curPill.style.opacity = "1";
    };
    if (current) setCurrent(current, true);

    var hoverShown = false;
    links.forEach(function (link) {
      var enter = function () {
        place(hoverPill, link, !hoverShown);
        hoverPill.style.opacity = "1";
        hoverShown = true;
      };
      link.addEventListener("mouseenter", enter);
      link.addEventListener("focus", enter);
      link.addEventListener("click", function (e) {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (link === current || reduce) return;
        e.preventDefault();
        hoverPill.style.opacity = "0";
        setCurrent(link, !current);
        setTimeout(function () { window.location.href = link.href; }, 260);
      });
    });
    nav.addEventListener("mouseleave", function () { hoverPill.style.opacity = "0"; hoverShown = false; });
    nav.addEventListener("focusout", function () { hoverPill.style.opacity = "0"; hoverShown = false; });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (current) place(curPill, current, true); });
    window.addEventListener("resize", function () { if (current) place(curPill, current, true); });
    window.addEventListener("pageshow", function (ev) {
      if (ev.persisted && current) setCurrent(current, true);
      if (ev.persisted && !current) curPill.style.opacity = "0";
    });
  }

  if (reduce) return;

  var slider = document.querySelector(".slider");
  var track = document.querySelector(".track");
  if (!slider || !track) return;

  // Duplicate the cards so the loop never shows a gap.
  Array.prototype.slice.call(track.children).forEach(function (card) {
    var copy = card.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    track.appendChild(copy);
  });
  slider.classList.add("is-animated");
})();
