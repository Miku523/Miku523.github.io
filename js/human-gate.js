// ============================================
// 人机验证进场门（human-gate）—— 运行时
//
// 配置：source/_data/human-gate.yml（经 scripts/human-gate.js 注入为
//       window.__GATE_CONFIG__，本文件自己不写死任何文案）
// 样式：source/_data/styles.styl 末尾的「人机验证进场门」段落
//
// 流程：整页加载 → 没验证过就盖全屏卡片（锁定滚动）
//       → 点「我不是机器人」→ 复选框变转圈、小字轮播
//       → 随机 0.9~1.6s 后打勾、卡片内樱花绽放
//       → 停一会儿开始淡出，同时派发 'human:verified'
//         （打字机的欢迎弹层听到事件才开始进场，两层不会叠）
//       → 卡片移除、解除滚动锁定
//
// 给打字机（typewriter.js）看的三个信号：
//   window.__HUMAN_GATE_ACTIVE__   本页要出验证门（启动时同步置位）
//   window.__humanGateVerified     本会话已通过（含之前页/之前刷新）
//   window 事件 'human:verified'   放行瞬间派发
// ============================================
(function () {
  'use strict';

  var CFG = window.__GATE_CONFIG__ || {};
  if (CFG.enable === false) return;

  var KEY = 'human-gate-passed';
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function num(v, d) {
    var n = Number(v);
    return isFinite(n) && n >= 0 ? n : d;
  }

  function storagePassed() {
    try {
      return sessionStorage.getItem(KEY) === '1';
    } catch (err) {
      return false;   // 隐身模式等禁 sessionStorage 的情况，就当没验过
    }
  }

  function markPassed() {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch (err) { /* 存不了就算了，最多下次再验一次 */ }
  }

  // ---------- 本会话早就验过了：不弹门，只立 flag 让欢迎弹层直接放行 ----------
  if (CFG.once_per_session !== false && storagePassed()) {
    window.__humanGateVerified = true;
    return;
  }

  // 本页要出验证门：同步立 ACTIVE flag（defer 脚本都在 DOMContentLoaded
  // 前跑完，typewriter 的 setupWelcome 一定能看到它）
  window.__HUMAN_GATE_ACTIVE__ = true;

  // ---------- DOM ----------
  // 樱花五瓣装饰（与打字机卡片同款，视觉上是一家人）
  var PETAL_SVG = '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">'
    + '<g class="hg-petal" fill="currentColor" transform="translate(12 12.6)">'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(72)"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(144)"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(216)"/>'
    + '<ellipse cx="0" cy="-6.6" rx="2.55" ry="3.95" transform="rotate(288)"/>'
    + '</g>'
    + '<circle class="hg-petal-core" cx="12" cy="12.6" r="1.75"/>'
    + '</svg>';

  var root = document.createElement('div');
  root.className = 'human-gate' + (CFG.blur !== false ? ' human-gate--blur' : '');
  root.id = 'human-gate';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', CFG.title || '人机验证');
  root.innerHTML =
    '<div class="human-gate-backdrop" aria-hidden="true"></div>'
    + '<div class="human-gate-card">'
    + '<span class="human-gate-petals" aria-hidden="true">'
    + '<i></i><i></i><i></i><i></i><i></i>'
    + '</span>'
    + '<div class="human-gate-head">'
    + '<span class="human-gate-deco">' + PETAL_SVG + '</span>'
    + '<span class="human-gate-title">' + escHtml(CFG.title || '') + '</span>'
    + '</div>'
    + '<div class="human-gate-body">'
    + (CFG.message ? '<p class="human-gate-msg">' + escHtml(CFG.message) + '</p>' : '')
    + '<button type="button" class="human-gate-check" id="human-gate-check">'
    + '<span class="human-gate-box" aria-hidden="true">'
    + '<svg class="human-gate-mark" viewBox="0 0 24 24">'
    + '<path d="M5 12.6l4.4 4.4L19 7.4" fill="none" stroke="currentColor"'
    + ' stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>'
    + '<span class="human-gate-spin"></span>'
    + '</span>'
    + '<span class="human-gate-label">' + escHtml(CFG.button || '') + '</span>'
    + (CFG.brand
        ? '<span class="human-gate-brand">' + PETAL_SVG + '<i>'
          + escHtml(CFG.brand) + '</i></span>'
        : '')
    + '</button>'
    + (CFG.footer
        ? '<p class="human-gate-foot">' + escHtml(CFG.footer) + '</p>'
        : '')
    + '</div>'
    + '</div>';

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var btn, label, lineTimer = null;
  var state = 'wait';        // wait → verifying → passed → out
  var prevOverflow = '';

  function lockScroll() {
    prevOverflow = document.documentElement.style.overflow
      + '|' + document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function unlockScroll() {
    var prev = prevOverflow.split('|');
    document.documentElement.style.overflow = prev[0] || '';
    document.body.style.overflow = prev[1] || '';
  }

  // ---------- 验证中：小字轮播 ----------
  function startLines() {
    var lines = CFG.verify_lines || [];
    if (!lines.length) return;
    var interval = num(CFG.verify_line_interval, 620);
    var last = -1;
    lineTimer = setInterval(function () {
      if (lines.length === 1) return;
      var i;
      do {
        i = Math.floor(Math.random() * lines.length);
      } while (i === last);
      last = i;
      label.textContent = lines[i];
    }, interval);
  }

  function stopLines() {
    if (lineTimer) {
      clearInterval(lineTimer);
      lineTimer = null;
    }
  }

  // 通知欢迎弹层可以进场了（老内核没有 Event 构造器，退回 createEvent）
  function emitVerified() {
    try {
      window.dispatchEvent(new Event('human:verified'));
      return;
    } catch (err) { /* 试兜底写法 */ }

    try {
      var e = document.createEvent('Event');
      e.initEvent('human:verified', false, false);
      window.dispatchEvent(e);
    } catch (err2) { /* 都发不出去也不影响放行：门会照常淡出移除 */ }
  }

  // ---------- 放行 ----------
  function pass() {
    if (state !== 'verifying') return;
    state = 'passed';

    stopLines();
    markPassed();
    window.__humanGateVerified = true;

    root.classList.remove('is-verifying');
    root.classList.add('is-passed');
    label.textContent = CFG.success || '验证通过';
    btn.disabled = true;
    btn.setAttribute('aria-label', (CFG.success || '验证通过'));

    var hold = num(CFG.hold_time, 900);
    var fade = num(CFG.fade_time, 620);

    setTimeout(function () {
      if (state === 'out') return;
      state = 'out';
      // 此刻才通知欢迎弹层进场：门正在淡出，8~9 百毫秒后欢迎卡滑入，
      // 两层一收一放正好接上，不会叠在一起
      emitVerified();
      root.classList.add('is-out');
      unlockScroll();
      setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
      }, fade + 120);
    }, hold);
  }

  // ---------- 点击复选框 → 验证中 ----------
  function verify() {
    if (state !== 'wait') return;
    state = 'verifying';
    root.classList.add('is-verifying');
    btn.disabled = true;

    if (REDUCE) {
      // 系统「减少动态效果」：不转圈不轮播，直接过
      pass();
      return;
    }

    if ((CFG.verify_lines || []).length > 1) startLines();

    var min = num(CFG.verify_min, 900);
    var max = Math.max(num(CFG.verify_max, 1600), min);
    var dur = min + Math.random() * (max - min);
    setTimeout(pass, dur);
  }

  // ---------- 启动 ----------
  function show() {
    document.body.appendChild(root);
    btn = root.querySelector('.human-gate-check');
    label = root.querySelector('.human-gate-label');

    // DOM 不完整（理论上不会发生，但拦路组件不能赌）：直接拆门放行
    if (!btn || !label) {
      if (root.parentNode) root.parentNode.removeChild(root);
      window.__humanGateVerified = true;
      emitVerified();
      return;
    }

    // 保险先注册、后锁滚动：万一中间哪步抛异常，60 秒后也能自动放行，
    // 不会把访客永久锁在外面。它只负责"救急"，不替看得慢的人做决定。
    setTimeout(function () {
      if (state === 'wait') verify();
      else if (state === 'verifying') pass();
    }, 60000);

    lockScroll();
    btn.addEventListener('click', verify);

    // 下一帧再挂 is-in，让入场过渡有得播
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.add('is-in');
        try { btn.focus({ preventScroll: true }); } catch (err) { btn.focus(); }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show);
  } else {
    show();
  }
})();
