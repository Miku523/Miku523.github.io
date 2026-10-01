{#-
  2026-10-01 本站定制（配合 pjax.swig 的 #pjax 不交换方案，升级主题时一并带走）：
  原版的这个 partial 只输出脚本、挂在 bodyEnd 注入点（#pjax 容器内）；
  本站 #pjax 不参与 pjax 交换，脚本放那里就永远不会随文章切换。
  因此把「容器 + 样式 + 脚本」整体挪进 comment 注入点（文章内容流内），
  随 .content-wrap 一起被 pjax 换入，脚本靠 data-pjax 在 pjax:success 时重执行。
-#}
{%- if page.comments %}
<div class="comments" id="gitalk-container"></div>
{%- set gitalk_css_uri = theme.vendors.gitalk_css or '//cdn.jsdelivr.net/npm/gitalk@1/dist/gitalk.min.css' %}
<link rel="stylesheet" href="{{ gitalk_css_uri }}">

{%- set gitalk_js_uri = theme.vendors.gitalk_js or '//cdn.jsdelivr.net/npm/gitalk@1/dist/gitalk.min.js' %}

<script{{ pjax }}>
// 2026-10-01：脚本现在在文章内容流里，直开页面解析到此处时 NexT.utils（body 末尾）
// 尚未加载，直接调用会 TypeError；pjax 重执行时 utils 又必须立即可用。
// 所以：utils 就绪就立即跑，没就绪就等 window load（pjax 场景 load 早已触发，
// 会走立即分支，两条路径都覆盖）。
(function () {
  function bootGitalk() {
    NexT.utils.loadComments(document.querySelector('#gitalk-container'), () => {
      NexT.utils.getScript('{{ gitalk_js_uri }}', () => {
        var gitalk = new Gitalk({
          clientID    : '{{ theme.gitalk.client_id }}',
          clientSecret: '{{ theme.gitalk.client_secret }}',
          repo        : '{{ theme.gitalk.repo }}',
          owner       : '{{ theme.gitalk.github_id }}',
          admin       : ['{{ theme.gitalk.admin_user }}'],
          id          : '{{ gitalk_md5(page.path) }}',
          {%- if theme.gitalk.language == '' %}
            language: window.navigator.language || window.navigator.userLanguage,
          {% else %}
            language: '{{ theme.gitalk.language }}',
          {%- endif %}
          distractionFreeMode: {{ theme.gitalk.distraction_free_mode }}
        });
        gitalk.render('gitalk-container');
      }, window.Gitalk);
    });
  }
  if (window.NexT && NexT.utils) {
    bootGitalk();
  } else {
    window.addEventListener('load', bootGitalk);
  }
})();
</script>
{%- endif %}
