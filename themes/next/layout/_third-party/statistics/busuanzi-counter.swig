{%- if theme.busuanzi_count.enable %}
<div class="busuanzi-count">
  {#- 2026-09-30 修复：不蒜子服务不稳定（实测间歇性连接超时 40s+），
      原来的 <script async> 虽异步执行但会阻塞 window load 事件，
      导致 pace 进度条一直转圈。改为 window load 后再动态注入脚本，
      服务挂掉时计数位保持隐藏（display:none），页面加载完全不受影响。 -#}
  <script{{ pjax }}>
    window.addEventListener('load', function () {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
      document.body.appendChild(s);
    });
  </script>

  {%- if theme.busuanzi_count.total_visitors %}
    <span class="post-meta-item" id="busuanzi_container_site_uv" style="display: none;">
      <span class="post-meta-item-icon">
        <i class="{{ theme.busuanzi_count.total_visitors_icon }}"></i>
      </span>
      <span class="site-uv" title="{{ __('footer.total_visitors') }}">
        <span id="busuanzi_value_site_uv"></span>
      </span>
    </span>
  {%- endif %}

  {%- if theme.busuanzi_count.total_visitors and theme.busuanzi_count.total_views %}
    <span class="post-meta-divider">|</span>
  {%- endif %}

  {%- if theme.busuanzi_count.total_views %}
    <span class="post-meta-item" id="busuanzi_container_site_pv" style="display: none;">
      <span class="post-meta-item-icon">
        <i class="{{ theme.busuanzi_count.total_views_icon }}"></i>
      </span>
      <span class="site-pv" title="{{ __('footer.total_views') }}">
        <span id="busuanzi_value_site_pv"></span>
      </span>
    </span>
  {%- endif %}
</div>
{%- endif %}
