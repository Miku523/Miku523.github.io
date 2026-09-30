/* global hexo */
'use strict';

// ============================================
// 打字机效果（和风樱花打字机）—— 标签插件 + 模板辅助函数
//
// 配置：source/_data/typewriter.yml（文案、速度、字体都在那儿改）
// 运行：source/js/typewriter.js（body-end.swig 里以 defer 引入）
// 样式：source/_data/styles.styl 末尾的「和风樱花打字机」段落
//
// 本文件负责三件事：
//   1) typewriter 标签：渲染一块打字机卡片
//   2) after_render:html 过滤器：往每个页面的 <head> 插手写体 webfont，
//      往 </body> 前插配置和运行脚本（网站不需要在模板里写任何东西）
//      —— 配置里同时带上 welcome（进场欢迎弹层）的文案与节奏
//   3) 读 source/_data/typewriter.yml，作为上面两件事的唯一配置来源
//
// 注意：改完本文件 / typewriter.yml 后直接 generate 即可；
//       若发现内容没变，删掉 db.json（或 hexo clean）再 generate。
// ============================================

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// 简单的文件级缓存：generate 一次只读一遍，文件改动后自动失效
let cache = null;
let cacheKey = '';

const DEFAULTS = {
  enable: true,
  font: {
    enable: true,
    url: 'https://fastly.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css',
    family: 'LXGW WenKai'
  },
  timing: {
    type_speed: 135,
    delete_speed: 55,
    hold_time: 2400,
    gap_time: 460,
    start_delay: 900,
    jitter: 45,
    pause_on_hover: true,
    click_to_skip: true
  },
  subtitle: {
    enable: true,
    keep_original: true,
    lines: []
  },
  welcome: {
    enable: true,
    scope: 'home',
    once_per_session: true,
    position: 'center',
    title: '',
    footer: '',
    delay: 850,
    type_speed: 82,
    hold_time: 3000,
    fade_time: 680,
    auto_close: true,
    closable: true,
    mask: true,
    random: true,
    lines: []
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

function loadConfig() {
  const file = path.join(hexo.source_dir, '_data', 'typewriter.yml');

  let stat;
  try {
    stat = fs.statSync(file);
  } catch (err) {
    hexo.log.warn('[typewriter] 没找到 source/_data/typewriter.yml，打字机将不生效');
    return DEFAULTS;
  }

  const key = stat.mtimeMs + ':' + stat.size;
  if (cache && cacheKey === key) return cache;

  let doc = {};
  try {
    doc = yaml.load(fs.readFileSync(file, 'utf8')) || {};
  } catch (err) {
    hexo.log.error('[typewriter] 解析 source/_data/typewriter.yml 失败：' + err.message);
    doc = {};
  }

  // 浅合并：只在用户少写了字段时兜底，不覆盖用户写的值
  const cfg = Object.assign({}, DEFAULTS, doc);
  cfg.font = Object.assign({}, DEFAULTS.font, doc.font || {});
  cfg.timing = Object.assign({}, DEFAULTS.timing, doc.timing || {});
  cfg.subtitle = Object.assign({}, DEFAULTS.subtitle, doc.subtitle || {});
  cfg.subtitle.lines = (Array.isArray(cfg.subtitle.lines) ? cfg.subtitle.lines : [])
    .map(line => String(line).trim())
    .filter(Boolean);

  cfg.welcome = Object.assign({}, DEFAULTS.welcome, doc.welcome || {});
  cfg.welcome.lines = (Array.isArray(cfg.welcome.lines) ? cfg.welcome.lines : [])
    .map(line => String(line).trim())
    .filter(Boolean);

  cache = cfg;
  cacheKey = key;
  return cache;
}

// ---------- 1) {% typewriter %} 标签 ----------
// 输出一块卡片：左边一朵樱花，右边打字区 + 光标
function renderBlock(lines, opts) {
  const first = lines[0] || '';
  const attrs = Object.keys(opts).map(k =>
    ' data-' + k + '="' + escapeAttr(opts[k]) + '"').join('');

  return '<div class="tw-block"'
    + ' data-lines="' + escapeAttr(JSON.stringify(lines)) + '"' + attrs + '>'
    + '<span class="tw-deco" aria-hidden="true">'
    + '<svg viewBox="0 0 24 24" focusable="false">'
    + '<g class="tw-petal" fill="currentColor" transform="translate(12 12.6)">'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(72)"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(144)"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(216)"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(288)"/>'
    + '</g>'
    + '<circle class="tw-petal-core" cx="12" cy="12.6" r="1.75"/>'
    + '</svg>'
    + '</span>'
    + '<span class="tw-body">'
    + '<span class="tw-line">'
    + '<span class="tw-text">' + escapeHtml(first) + '</span>'
    + '<span class="tw-caret" aria-hidden="true"></span>'
    + '</span>'
    + (lines.length > 1 && opts.loop !== 'false'
        ? '<span class="tw-hint">点一下，换一句</span>' : '')
    + '</span>'
    + '</div>';
}

// 标签参数：{% typewriter speed:90 hold:3000 loop:false %}
const ARG_MAP = {
  speed: 'speed',
  type: 'speed',
  delete: 'delete',
  del: 'delete',
  hold: 'hold',
  gap: 'gap',
  delay: 'delay',
  loop: 'loop'
};

hexo.extend.tag.register('typewriter', function (args, content) {
  try {
    const opts = {};
    (args || []).forEach(arg => {
      const idx = String(arg).indexOf(':');
      if (idx < 0) return;
      const key = String(arg).slice(0, idx).trim().toLowerCase();
      const val = String(arg).slice(idx + 1).trim();
      if (ARG_MAP[key] && val) opts[ARG_MAP[key]] = val;
    });

    const lines = String(content || '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    if (!lines.length) {
      return '<!-- {% typewriter %} 里没写内容，这样用：\n{% typewriter %}\n第一句\n第二句\n{% endtypewriter %} -->';
    }

    return renderBlock(lines, opts);
  } catch (err) {
    hexo.log.error('[typewriter] 渲染失败：' + err.message);
    return '<!-- typewriter render error: ' + escapeHtml(err.message) + ' -->';
  }
}, { ends: true });

// ---------- 2) 往每个页面注入：字体 + 配置 + 脚本 ----------
// 用 after_render:html 过滤器统一注入，不依赖模板里的辅助函数
// （source/_data/*.swig 是 nunjucks 模板，拿不到 Hexo 的 helper）
function buildHead(cfg) {
  const font = cfg.font || {};

  const stack = family =>
    '"' + family + '","Kaiti SC",KaiTi,STKaiti,"楷体","AR PL UKai CN","Songti SC",serif';

  // 字体关掉时也要把变量置回纯系统字体栈，免得 CSS 里的默认值仍在找 webfont
  if (font.enable === false || !font.url) {
    return '<style>:root{--tw-font:' + stack('KaiTi') + '}</style>\n';
  }

  let host = 'https://fastly.jsdelivr.net';
  try {
    host = new URL(font.url).origin;
  } catch (err) { /* 地址不合法就退回默认 CDN 做预连接 */ }

  // 2026-09-30：字体 CSS 改为非阻塞加载（preload + onload 切 rel）。
  // 装饰性字体不该卡住首屏渲染——CDN 慢/挂时页面先用系统楷体渲染，
  // webfont 到了再切换，视觉回退本来就设计成成立。
  return '<!-- 和风樱花打字机：手写体 webfont（按 unicode-range 分片，只下载用到的字） -->\n'
    + '<link rel="preconnect" href="' + escapeAttr(host) + '" crossorigin>\n'
    + '<link rel="preload" as="style" href="' + escapeAttr(font.url) + '" onload="this.onload=null;this.rel=\'stylesheet\'">\n'
    + '<noscript><link rel="stylesheet" href="' + escapeAttr(font.url) + '"></noscript>\n'
    + '<style>:root{--tw-font:' + stack(font.family) + '}</style>\n';
}

function buildBody(cfg) {
  const payload = {
    enable: cfg.enable !== false,
    timing: cfg.timing,
    subtitle: {
      enable: cfg.subtitle.enable !== false,
      keep_original: cfg.subtitle.keep_original !== false,
      lines: cfg.subtitle.lines
    },
    welcome: {
      enable: cfg.welcome.enable !== false,
      scope: cfg.welcome.scope === 'all' ? 'all' : 'home',
      once_per_session: cfg.welcome.once_per_session !== false,
      position: cfg.welcome.position === 'corner' ? 'corner' : 'center',
      title: String(cfg.welcome.title || ''),
      footer: String(cfg.welcome.footer || ''),
      delay: cfg.welcome.delay,
      type_speed: cfg.welcome.type_speed,
      hold_time: cfg.welcome.hold_time,
      fade_time: cfg.welcome.fade_time,
      auto_close: cfg.welcome.auto_close !== false,
      closable: cfg.welcome.closable !== false,
      mask: cfg.welcome.mask !== false,
      random: cfg.welcome.random !== false,
      lines: cfg.welcome.lines
    }
  };

  // JSON 里出现 </script> 会提前闭合脚本标签，统一把 < 转义掉
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');

  return '<!-- 和风樱花打字机：配置 + 运行脚本（defer，等 DOM 就绪再动手） -->\n'
    + '<script>window.__TW_CONFIG__=' + json + ';</script>\n'
    + '<script defer src="/js/typewriter.js"></script>\n';
}

hexo.extend.filter.register('after_render:html', function (html) {
  try {
    if (!html || html.indexOf('</head>') < 0) return html;

    const cfg = loadConfig();
    if (cfg.enable === false) return html;

    const head = buildHead(cfg);
    const body = buildBody(cfg);

    // 用函数式替换：替换文本里的 $ 不会被当成正则占位符
    if (head) html = html.replace('</head>', () => head + '</head>');
    if (html.indexOf('</body>') >= 0) {
      html = html.replace('</body>', () => body + '</body>');
    }
    return html;
  } catch (err) {
    hexo.log.error('[typewriter] 注入失败：' + err.message);
    return html;
  }
});
