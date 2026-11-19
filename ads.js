// Starts each AdSense unit once. Units that are hidden (side rails on small screens) are skipped,
// because AdSense cannot size an ad inside a hidden box.
(function () {
  function start() {
    var units = document.querySelectorAll('ins.adsbygoogle');
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      if (u.getAttribute('data-ad-status') || u.dataset.mbwStarted) continue;
      if (!u.offsetWidth) continue;
      u.dataset.mbwStarted = '1';
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ad blocked or unavailable */ }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('resize', start);
})();
