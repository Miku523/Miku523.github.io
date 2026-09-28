/* global hexo */
'use strict';

// ============================================
// 文章头图（banner）注入
// 作用：markdown 渲染完成后，把 front-matter 里的 banner
//       图片插到文章正文最顶部（标题与 meta 下方）。
//
// —— 单篇文章用法（source/_posts/*.md 的 front-matter）——
//   banner: /images/xxx.jpg        本站图片（放 source/images/ 下）
//   banner: https://.../a.jpg      或任意外链
//   banner_alt: 头图替代文字       可选
//   banner_height: 320             可选，固定高度（像素）
//   banner: false                  显式禁用（配了全站默认头图时用）
//
// —— 全站默认头图（可选，站点 _config.yml）——
//   banner:
//     default: /images/banner-default.jpg
//   未单独指定 banner 的文章会自动使用默认头图
//
// 样式：source/_data/styles.styl 末尾的 .post-banner 段落
// 注意：新增/修改本文件后，需要删掉 db.json（或 hexo clean）再
//       hexo generate，已渲染文章的内容缓存才会带上头图。
// ============================================

const escapeAttr = str => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

hexo.extend.filter.register('after_post_render', data => {
  if (!data || !data.content) return data;
  if (data.banner === false) return data; // 单篇显式禁用

  const cfg = (hexo.config && hexo.config.banner) || {};
  const src = data.banner || cfg.default; // 单篇优先，其次全站默认
  if (!src) return data;

  const alt = escapeAttr(data.banner_alt || data.title || '');
  const height = parseInt(data.banner_height, 10);
  const style = height > 0 ? ` style="--banner-h:${height}px"` : '';

  data.content =
    `<div class="post-banner"${style}><img src="${escapeAttr(src)}" alt="${alt}"></div>\n` +
    data.content;

  return data;
});
