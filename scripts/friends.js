/* global hexo */
'use strict';

// ============================================
// 友链卡片渲染（标签插件）
//
// 用法：在任意页面/文章里写一行 {% friends %}，就会把
//       source/_data/friends.yml 里的友链渲染成毛玻璃卡片墙。
//
// 数据文件：source/_data/friends.yml（字段说明见该文件顶部注释）
// 页面：    source/links/index.md（菜单里的「友链」）
// 样式：    source/_data/styles.styl 末尾的「友链页面」段落
//
// 注意：修改本文件或 friends.yml 后，直接重新 generate 即可；
//       若发现内容没变，删掉 db.json（或 hexo clean）再 generate。
// ============================================

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// 简单的文件级缓存：generate 一次只读一遍，文件改动后自动失效
let cache = null;
let cacheKey = '';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadFriends() {
  const file = path.join(hexo.source_dir, '_data', 'friends.yml');

  let stat;
  try {
    stat = fs.statSync(file);
  } catch (err) {
    hexo.log.warn('[friends] 没找到 source/_data/friends.yml，友链页面会是空的');
    return [];
  }

  const key = stat.mtimeMs + ':' + stat.size;
  if (cache && cacheKey === key) return cache;

  let list = [];
  try {
    const doc = yaml.load(fs.readFileSync(file, 'utf8')) || {};
    list = Array.isArray(doc) ? doc : (doc.friends || []);
  } catch (err) {
    hexo.log.error('[friends] 解析 source/_data/friends.yml 失败：' + err.message);
    list = [];
  }

  cache = list
    .filter(item => item && item.name && item.url)
    .map(item => ({
      name: String(item.name),
      url: String(item.url),
      avatar: item.avatar ? String(item.avatar).trim() : '',
      desc: item.desc ? String(item.desc).trim() : '',
      group: item.group ? String(item.group).trim() : ''
    }));
  cacheKey = key;

  return cache;
}

// 头像：给了地址就用图片，没给就用站点名首字生成色块，避免出现裂图
function renderAvatar(item) {
  if (item.avatar) {
    return '<span class="friend-avatar"><img src="' + escapeHtml(item.avatar)
      + '" alt="' + escapeHtml(item.name) + '" loading="lazy" decoding="async"></span>';
  }
  const first = Array.from(item.name)[0] || '友';
  return '<span class="friend-avatar friend-avatar--text"><i>'
    + escapeHtml(first) + '</i></span>';
}

function renderCard(item) {
  const href = /^(https?:)?\/\//i.test(item.url) ? item.url : 'https://' + item.url;
  return '<a class="friend-card" href="' + escapeHtml(href) + '" target="_blank" rel="noopener">'
    + renderAvatar(item)
    + '<span class="friend-info">'
    + '<span class="friend-name">' + escapeHtml(item.name) + '</span>'
    + (item.desc ? '<span class="friend-desc">' + escapeHtml(item.desc) + '</span>' : '')
    + '</span></a>';
}

function renderFriends() {
  const list = loadFriends();

  if (!list.length) {
    return '<div class="friends-empty">还没有添加友链，去 '
      + '<code>source/_data/friends.yml</code> 里加几条吧～</div>';
  }

  // 按 group 分组，保持 YAML 里的先后顺序
  const order = [];
  const groups = {};
  list.forEach(item => {
    const key = item.group || '朋友们';
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(item);
  });

  const multi = order.length > 1;
  const blocks = order.map(name => {
    const cards = groups[name].map(renderCard).join('');
    return '<div class="friends-group">'
      + (multi ? '<div class="friends-group-title">' + escapeHtml(name) + '</div>' : '')
      + '<div class="friends-grid">' + cards + '</div>'
      + '</div>';
  }).join('');

  return '<div class="friends-page">' + blocks + '</div>';
}

// 注册标签：{% friends %}
hexo.extend.tag.register('friends', function () {
  try {
    return renderFriends();
  } catch (err) {
    hexo.log.error('[friends] 渲染失败：' + err.message);
    return '<!-- friends render error: ' + escapeHtml(err.message) + ' -->';
  }
});
