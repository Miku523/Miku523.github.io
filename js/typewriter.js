// ============================================
// 打字机效果（和风樱花打字机）—— 运行脚本
//
// 配置：source/_data/typewriter.yml
// 样式：source/_data/styles.styl 的「和风樱花打字机」段落
//
// 两个场景共用同一套引擎：
//   .tw--subtitle  站名下方那行副标题（全站都有）
//   .tw-block      {% typewriter %} 标签渲染出来的卡片
//
// 播放方式：逐字打出 → 停留 → 逐字退格 → 停顿 → 下一条，循环往复。
//   打字时光标常亮（有"正在输入"的感觉），停顿时呼吸闪烁。
//   鼠标移上去暂停、点一下换下一条；
//   切到别的标签页或滚出屏幕会自动暂停，回来再接着打。
//   系统开了「减少动态效果」时只显示第一句，不做动画。
// ============================================
(function () {
  'use strict';

  var CFG = window.__TW_CONFIG__;
  if (!CFG || CFG.enable === false) return;

  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- 工具 ----------
  function num(value, fallback) {
    var n = parseFloat(value);
    return isNaN(n) ? fallback : n;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function defaults() {
    return {
      type: 135,    // 打字间隔
      del: 55,      // 退格间隔
      hold: 2400,   // 打完停留
      gap: 460,     // 两条之间停顿
      delay: 900,   // 开始前延迟
      jitter: 45,   // 打字节奏抖动
      pauseOnHover: true,
      clickToSkip: true,
      loop: true
    };
  }

  // 把 YAML 的 timing 段落翻译成引擎参数
  function applyTiming(opts, timing) {
    if (!timing) return opts;
    opts.type = num(timing.type_speed, opts.type);
    opts.del = num(timing.delete_speed, opts.del);
    opts.hold = num(timing.hold_time, opts.hold);
    opts.gap = num(timing.gap_time, opts.gap);
    opts.delay = num(timing.start_delay, opts.delay);
    opts.jitter = num(timing.jitter, opts.jitter);
    if (timing.pause_on_hover === false) opts.pauseOnHover = false;
    if (timing.click_to_skip === false) opts.clickToSkip = false;
    return opts;
  }

  // 把标签上的 data-* 参数翻译成引擎参数
  function applyAttrs(opts, el) {
    if (!el) return opts;
    opts.type = num(el.getAttribute('data-speed'), opts.type);
    opts.del = num(el.getAttribute('data-delete'), opts.del);
    opts.hold = num(el.getAttribute('data-hold'), opts.hold);
    opts.gap = num(el.getAttribute('data-gap'), opts.gap);
    opts.delay = num(el.getAttribute('data-delay'), opts.delay);
    if (el.getAttribute('data-loop') === 'false') opts.loop = false;
    return opts;
  }

  // ---------- 打字机 ----------
  function Typewriter(root, lines, opts) {
    this.root = root;
    this.el = root.querySelector('.tw-text');
    this.lines = lines;
    this.o = opts;
    this.i = 0;          // 当前第几句
    this.n = 0;          // 当前已打出几个字
    this.state = 'type';
    this.timer = null;
    this.locks = {};      // hover / hidden / offscreen 三个暂停理由
    this.hint = root.querySelector('.tw-hint');
    if (!this.el) return;

    // 尊重系统设置：直接显示第一句，不做动画
    if (REDUCE) {
      this.el.textContent = lines[0];
      root.classList.add('tw-static');
      return;
    }

    this.el.textContent = '';
    this.bind();
    this.schedule(opts.delay, 'type');
  }

  Typewriter.prototype.schedule = function (delay, state) {
    var self = this;
    clearTimeout(this.timer);
    this.state = state;
    this.timer = setTimeout(function () { self.step(); }, Math.max(0, delay));
  };

  Typewriter.prototype.step = function () {
    if (this.paused()) return;
    var self = this;
    var o = this.o;
    var line = this.lines[this.i];

    if (this.state === 'type') {
      if (this.n < line.length) {
        this.root.classList.add('is-typing');
        this.n++;
        this.el.textContent = line.slice(0, this.n);
        var d = o.type + (Math.random() * 2 - 1) * o.jitter;
        this.schedule(d, 'type');
      } else {
        // 打完了：光标开始闪，停一会儿再退格
        this.root.classList.remove('is-typing');
        if (!o.loop) {          // loop:false 就停在这一句上
          if (o.onFinish) o.onFinish();
          return;
        }
        this.schedule(o.hold + line.length * 25, 'delete');
      }
    } else if (this.state === 'delete') {
      if (this.n > 0) {
        this.root.classList.add('is-typing');
        this.n--;
        this.el.textContent = line.slice(0, this.n);
        this.schedule(o.del, 'delete');
      } else {
        this.root.classList.remove('is-typing');
        this.next();
        this.schedule(o.gap, 'type');
      }
    }
  };

  Typewriter.prototype.next = function () {
    this.i = (this.i + 1) % this.lines.length;
    this.n = 0;
    this.el.textContent = '';
    // 换句时让左边的樱花闪一下
    var self = this;
    this.root.classList.remove('is-swap');
    void this.root.offsetWidth;
    this.root.classList.add('is-swap');
    setTimeout(function () { self.root.classList.remove('is-swap'); }, 620);
  };

  // 点一下直接换下一条
  Typewriter.prototype.skip = function () {
    if (!this.o.loop) return;
    if (this.hint) this.hint.classList.add('is-hidden');
    this.el.textContent = '';
    this.next();
    this.schedule(Math.min(this.o.gap, 260), 'type');
  };

  Typewriter.prototype.lock = function (reason) {
    this.locks[reason] = true;
    clearTimeout(this.timer);
  };

  Typewriter.prototype.unlock = function (reason) {
    if (!this.locks[reason]) return;
    delete this.locks[reason];
    // 还在被别的理由挡着就先不动，等最后一个理由解除
    if (!this.paused()) this.step();
  };

  Typewriter.prototype.paused = function () {
    return Object.keys(this.locks).length > 0;
  };

  Typewriter.prototype.bind = function () {
    var self = this;
    var root = this.root;

    if (this.o.pauseOnHover) {
      root.addEventListener('mouseenter', function () { self.lock('hover'); });
      root.addEventListener('mouseleave', function () { self.unlock('hover'); });
    }

    if (this.o.clickToSkip) {
      root.addEventListener('click', function () { self.skip(); });
    }

    // 切到别的标签页 → 停，省电
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) self.lock('hidden');
      else self.unlock('hidden');
    });

    // 滚出屏幕 → 停
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) self.unlock('offscreen');
        else self.lock('offscreen');
      }, { threshold: 0 }).observe(root);
    }
  };

  // ---------- 1) 站名下方的副标题 ----------
  function setupSubtitle() {
    var sub = CFG.subtitle || {};
    if (sub.enable === false) return;

    var el = document.querySelector('.site-subtitle');
    if (!el) return;

    var lines = (sub.lines || []).slice();
    var original = (el.textContent || '').trim();

    if (sub.keep_original !== false && original && lines.indexOf(original) === -1) {
      lines.unshift(original);
    }
    if (!lines.length) return;

    el.classList.add('tw', 'tw--subtitle');
    el.innerHTML = '<span class="tw-text">' + escapeHtml(lines[0]) + '</span>'
      + '<span class="tw-caret" aria-hidden="true"></span>';

    var opts = applyTiming(defaults(), CFG.timing);
    opts.clickToSkip = false;   // 副标题就在站名下面，被误点的概率太高
    new Typewriter(el, lines, opts);
  }

  // ---------- 2) {% typewriter %} 卡片 ----------
  function setupBlocks() {
    var nodes = document.querySelectorAll('.tw-block');
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute('data-tw-init') === '1') return;   // pjax 换页重入时跳过已初始化的
      node.setAttribute('data-tw-init', '1');
      var lines = [];
      try {
        lines = JSON.parse(node.getAttribute('data-lines') || '[]');
      } catch (err) {
        lines = [];
      }
      lines = lines.map(function (l) { return String(l).trim(); }).filter(Boolean);
      if (!lines.length) return;

      var opts = applyAttrs(applyTiming(defaults(), CFG.timing), node);
      new Typewriter(node, lines, opts);
    });
  }

  // ---------- 3) 进场欢迎弹层 ----------
  // 进站后浮出一张卡片，打字机打出一句欢迎语，打完停留一会儿再淡出。
  // 位置、文案、速度、时长全在 source/_data/typewriter.yml 的 welcome 段落里改。
  var WELCOME_KEY = 'tw-welcome-shown';

  var PETAL_SVG = '<svg viewBox="0 0 24 24" focusable="false">'
    + '<g class="tw-petal" fill="currentColor" transform="translate(12 12.6)">'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(72)"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(144)"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(216)"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(288)"/>'
    + '</g>'
    + '<circle class="tw-petal-core" cx="12" cy="12.6" r="1.75"/>'
    + '</svg>';

  function isHomePage() {
    var p = window.location.pathname || '/';
    return p === '/' || /\/index\.html$/.test(p);
  }

  // 同一次会话里是否已经弹过了
  function alreadyShown() {
    try {
      return sessionStorage.getItem(WELCOME_KEY) === '1';
    } catch (err) {
      return false;   // 隐身模式等禁止 sessionStorage 的情况，就当没弹过
    }
  }

  function markShown() {
    try {
      sessionStorage.setItem(WELCOME_KEY, '1');
    } catch (err) { /* 存不了就算了，最多下次再弹一次 */ }
  }

  function setupWelcome() {
    var w = CFG.welcome || {};
    if (w.enable === false) return;

    var lines = (w.lines || []).map(function (l) { return String(l).trim(); }).filter(Boolean);
    if (!lines.length) return;

    if (w.scope === 'home' && !isHomePage()) return;
    if (w.once_per_session !== false) {
      if (alreadyShown()) return;
      markShown();
    }

    var position = w.position === 'corner' ? 'corner' : 'center';
    var text = w.random === false ? lines[0] : lines[Math.floor(Math.random() * lines.length)];
    var closable = w.closable !== false;
    var fade = num(w.fade_time, 680);

    var root = document.createElement('div');
    root.className = 'tw-welcome tw-welcome--' + position;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', '欢迎');
    root.innerHTML =
      (w.mask !== false && position === 'center' ? '<div class="tw-welcome-mask"></div>' : '')
      + '<div class="tw-welcome-card">'
      + '<span class="tw-welcome-petals" aria-hidden="true">'
      + '<i></i><i></i><i></i><i></i>'
      + '</span>'
      + '<div class="tw-welcome-head">'
      + '<span class="tw-welcome-deco" aria-hidden="true">' + PETAL_SVG + '</span>'
      + '<span class="tw-welcome-title">' + escapeHtml(w.title || '') + '</span>'
      + (closable
          ? '<button type="button" class="tw-welcome-close" aria-label="关闭">×</button>'
          : '')
      + '</div>'
      + '<div class="tw-welcome-body">'
      + '<span class="tw-line">'
      + '<span class="tw-text"></span>'
      + '<span class="tw-caret" aria-hidden="true"></span>'
      + '</span>'
      + '</div>'
      + (w.footer ? '<div class="tw-welcome-foot">' + escapeHtml(w.footer) + '</div>' : '')
      + '</div>';

    document.body.appendChild(root);

    var box = root.querySelector('.tw-welcome-card');
    var textEl = root.querySelector('.tw-text');
    var hideTimer = null;
    var done = false;
    var searchObserver = null;

    function onKey(e) {
      if (e.key === 'Escape' || e.keyCode === 27) dismiss();
    }

    function dismiss() {
      if (done) return;
      done = true;
      clearTimeout(hideTimer);
      document.removeEventListener('keydown', onKey);
      if (searchObserver) searchObserver.disconnect();
      root.classList.add('is-out');
      setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
      }, fade + 100);
    }

    if (closable) {
      root.querySelector('.tw-welcome-close').addEventListener('click', dismiss);
      document.addEventListener('keydown', onKey);
    }

    // 站内搜索一打开就给搜索面板让路（Ctrl+K / 点搜索按钮），别两层叠在一起
    var searchBox = document.getElementById('search-overlay');
    if (searchBox && window.MutationObserver) {
      searchObserver = new MutationObserver(function () {
        if (!searchBox.hidden) dismiss();
      });
      searchObserver.observe(searchBox, { attributes: true, attributeFilter: ['hidden'] });
    }

    var hold = num(w.hold_time, 3000);
    var speed = num(w.type_speed, 82);

    function startTyping(instant) {
      if (instant) {
        // 系统开了「减少动态效果」：直接把整句话摆出来，只是不逐字打
        textEl.textContent = text;
        box.classList.remove('is-typing');
        if (w.auto_close !== false) hideTimer = setTimeout(dismiss, hold);
        return;
      }

      new Typewriter(box, [text], {
        type: speed,
        del: 60,
        hold: hold,
        gap: 0,
        delay: 0,
        jitter: 30,
        pauseOnHover: false,
        clickToSkip: false,
        loop: false,
        onFinish: function () {
          if (w.auto_close === false) return;
          hideTimer = setTimeout(dismiss, hold);
        }
      });

      if (w.auto_close === false) return;
      // 兜底：万一打字被什么意外卡住（切走标签页、报错中断），也要按时收场
      setTimeout(function () {
        if (!done && hideTimer === null) hideTimer = setTimeout(dismiss, hold);
      }, text.length * speed * 3 + hold + 5000);
    }

    // 先滑入，再开始打字：两段动画错开会顺眼很多
    function slideIn() {
      setTimeout(function () {
        root.classList.add('is-in');
        if (REDUCE) {
          startTyping(true);
        } else {
          setTimeout(function () { startTyping(false); }, 260);
        }
      }, num(w.delay, 850));
    }

    // 人机验证门（human-gate）还没通过：先等它放行再进场。
    // 门开始淡出时会派发 'human:verified'，届时才起上面的延迟计时，
    // 一收一放正好接上，欢迎卡不会压在验证卡上面。
    // 验证门没启用 / 已通过 / 脚本没加载时 __HUMAN_GATE_ACTIVE__ 不存在，
    // 一切照旧（defer 脚本都在 DOMContentLoaded 前跑完，不存在时序竞争）。
    if (window.__HUMAN_GATE_ACTIVE__ && !window.__humanGateVerified) {
      // 兜底：万一验证门脚本中途出错、事件发不出来，90 秒后也照常进场，
      // 不能让一个装饰性组件把欢迎卡永久卡住
      var gateTimer = setTimeout(slideIn, 90000);
      window.addEventListener('human:verified', function () {
        clearTimeout(gateTimer);
        slideIn();
      }, { once: true });
    } else {
      slideIn();
    }
  }

  function boot() {
    setupSubtitle();
    setupBlocks();
    setupWelcome();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // pjax 换页（整页不刷新）后，新换进来的文章里可能有 {% typewriter %} 卡片，
  // 需要补一次初始化；副标题在头部（不换），欢迎弹层每会话只弹一次，都不用管。
  // setupBlocks 内部靠 data-tw-init 跳过旧卡片，重复触发安全。
  window.addEventListener('pjax:success', setupBlocks);
})();
