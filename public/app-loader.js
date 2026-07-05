// Removes the static splash loader once React has hydrated.
// Lives in its own file (rather than inline in index.html) so the CSP can
// enforce script-src without 'unsafe-inline' — inline scripts would otherwise
// require hash maintenance on every edit.
window.addEventListener('load', function () {
  setTimeout(function () {
    document.body.classList.add('app-loaded');
    setTimeout(function () {
      var loader = document.getElementById('app-loader');
      if (loader) loader.remove();
    }, 300);
  }, 100);
});
