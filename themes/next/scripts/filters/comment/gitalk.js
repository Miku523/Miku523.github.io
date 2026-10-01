/* global hexo */

'use strict';

const path = require('path');

// Add comment
hexo.extend.filter.register('theme_inject', injects => {
  let theme = hexo.theme.config;
  if (!theme.gitalk.enable) return;

  // 2026-10-01 本站定制：容器+脚本整体进 comment 注入点（文章内容流内），
  // 随 .content-wrap 被 pjax 换入；不再挂 bodyEnd（#pjax 容器本站不参与交换）。
  // 容器 div 已挪进 gitalk.swig 里，这里不再重复 raw 一个。
  injects.comment.file('gitalk', path.join(hexo.theme_dir, 'layout/_third-party/comments/gitalk.swig'));

});
