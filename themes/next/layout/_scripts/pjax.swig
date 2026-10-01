{#-
  2026-10-01 本站定制（与原版两处不同，升级主题时务必保留）：
  1) selectors 里去掉了 '#pjax'：#pjax 容器里是 bodyEnd 注入物（昼夜按钮、动态背景、
     搜索面板、Live2D、樱花特效），这些内容全站每页完全相同，不需要换；
     不换它们就永远只初始化一次 —— 否则每次跳页都会重建画布/WebGL 上下文，
     并在 document 上重复绑定全局监听（点一次开花变开两次、Ctrl+K 重复触发）。
  2) 下方重放脚本的查询器对应去掉 '#pjax script'，只重放：
     - script[data-pjax]（随 .content-wrap 换进来的评论等，如 gitalk）
     - script#page-configurations（每页不同的 CONFIG）
  音乐播放器骨架在 #pjax 之外（after_render 注入 </body> 前），天然存活、音频不间断。
-#}
<script>
var pjax = new Pjax({
  selectors: [
    'head title',
    '#page-configurations',
    '.content-wrap',
    '.post-toc-wrap',
    '.languages'
  ],
  switches: {
    '.post-toc-wrap': Pjax.switches.innerHTML
  },
  analytics: false,
  cacheBust: false,
  scrollTo : !CONFIG.bookmark.enable
});

window.addEventListener('pjax:success', () => {
  document.querySelectorAll('script[data-pjax], script#page-configurations').forEach(element => {
    var code = element.text || element.textContent || element.innerHTML || '';
    var parent = element.parentNode;
    parent.removeChild(element);
    var script = document.createElement('script');
    if (element.id) {
      script.id = element.id;
    }
    if (element.className) {
      script.className = element.className;
    }
    if (element.type) {
      script.type = element.type;
    }
    if (element.src) {
      script.src = element.src;
      // Force synchronous loading of peripheral JS.
      script.async = false;
    }
    if (element.dataset.pjax !== undefined) {
      script.dataset.pjax = '';
    }
    if (code !== '') {
      script.appendChild(document.createTextNode(code));
    }
    parent.appendChild(script);
  });
  NexT.boot.refresh();
  // Define Motion Sequence & Bootstrap Motion.
  if (CONFIG.motion.enable) {
    NexT.motion.integrator
      .init()
      .add(NexT.motion.middleWares.subMenu)
      .add(NexT.motion.middleWares.postList)
      .bootstrap();
  }
  NexT.utils.updateSidebarPosition();
});
</script>
