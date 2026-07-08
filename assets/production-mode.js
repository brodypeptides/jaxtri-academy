(function () {
  function apply() {
    document.body?.classList.add('production-mode');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
