<script>
(function(){
  // 尽早恢复昼夜偏好，避免刷新时闪烁（与 body-end.swig 配合）
  var saved = localStorage.getItem('next-darkmode');
  var dark = saved === null
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : saved === 'true';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
</script>
