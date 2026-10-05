// ============================================
// 人机验证进场门（human-gate）—— 运行时 v2：Cloudflare Turnstile
//
// 配置：source/_data/human-gate.yml（经 scripts/human-gate.js 注入为
//       window.__GATE_CONFIG__，本文件自己不写死任何文案/密钥）
// 样式：由注入器内联进每个页面的 <style id="human-gate-style">
//
// 三种工作模式（由 yml 的 turnstile 段决定）：
//   1) turnstile 模式（默认）：卡片里渲染真 Turnstile 组件
//      - api.js 懒加载：只在真的要出验证门的这一次会话里才请求
//        challenges.cloudflare.com（已验证过的访客一个字节都不多拉）
//      - token 只信服务端：拿到 token 后 POST 给 Worker
//        （chat.mikuascendlog.com/turnstile-verify）做 siteverify 复核，
//        复核通过才放行；token 一次性、5 分钟过期，前端伪造没有意义
//      - 昼夜主题跟随：渲染时读 html[data-theme]，切换主题自动重渲染
//   2) 国内逃生门（关键设计）：第三方实测 challenges.cloudflare.com 在
//      大陆加载不稳定（3 次里 1 次 60s 加载不出）。所以：
//      - api.js 加载失败 / 加载后 N 秒（load_timeout）iframe 还没出现
//        → 显示「直接进入」按钮，点了走装饰验证流程放行
//      - 逃生门只救"加载不出来"的真人，不影响正常验证（组件已渲染就
//        不自动弹逃生门）；strict 模式可整体关掉逃生门
//   3) 装饰模式（回退）：turnstile.enable=false 或没配 sitekey 时，
//      回到"我不是机器人"复选框的纯装饰流程，不依赖任何外部服务
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

  var TS = CFG.turnstile || {};
  var TS_ON = TS.enable !== false && !!TS.sitekey;

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

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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

  var MARK_SVG = '<svg class="human-gate-mark" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M5 12.6l4.4 4.4L19 7.4" fill="none" stroke="currentColor"'
    + ' stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // 结果行：Turnstile 模式下"复核中/放行中/通过"都复用这一套三态框
  var RESULT_HTML =
    '<span class="human-gate-box" aria-hidden="true">' + MARK_SVG
    + '<span class="human-gate-spin"></span></span>'
    + '<span class="human-gate-label"></span>';

  var root = document.createElement('div');
  root.className = 'human-gate' + (CFG.blur !== false ? ' human-gate--blur' : '');
  root.id = 'human-gate';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', CFG.title || '人机验证');

  var bodyHtml = (CFG.message ? '<p class="human-gate-msg">' + escHtml(CFG.message) + '</p>' : '');

  if (TS_ON) {
    bodyHtml +=
      '<div class="human-gate-tw" id="human-gate-tw"></div>'
      + '<div class="human-gate-result" hidden>' + RESULT_HTML + '</div>'
      + '<p class="human-gate-status" hidden></p>'
      + '<button type="button" class="human-gate-escape" hidden>'
      + escHtml(TS.escape_text || '验证加载不出来？点此直接进入 →') + '</button>';
  } else {
    bodyHtml +=
      '<button type="button" class="human-gate-check">'
      + '<span class="human-gate-box" aria-hidden="true">' + MARK_SVG
      + '<span class="human-gate-spin"></span></span>'
      + '<span class="human-gate-label">' + escHtml(CFG.button || '我不是机器人') + '</span>'
      + (CFG.brand
          ? '<span class="human-gate-brand">' + PETAL_SVG + '<i>'
            + escHtml(CFG.brand) + '</i></span>'
          : '')
      + '</button>';
  }

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
    + bodyHtml
    + (CFG.footer
        ? '<p class="human-gate-foot">' + escHtml(CFG.footer) + '</p>'
        : '')
    + '</div>'
    + '</div>';

  // ---------- 状态机 ----------
  // wait → verifying（装饰模式：点击后轮播；turnstile 模式：token 复核中/逃生放行中）
  //      → passed（打勾+樱花绽放）→ out（淡出移除）
  var state = 'wait';
  var prevOverflow = '';
  var btn, label, resultLabel, statusEl, escapeBtn, twBox;
  var widgetId = null;        // turnstile widget id
  var iframeTimer = null;
  var themeObserver = null;
  var lineTimer = null;       // 装饰模式：轮播小字

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

  function showStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.hidden = false;
    statusEl.classList.toggle('is-error', !!isError);
  }

  function stopTimers() {
    if (iframeTimer) { clearInterval(iframeTimer); iframeTimer = null; }
    if (lineTimer) { clearInterval(lineTimer); lineTimer = null; }
    if (themeObserver) { themeObserver.disconnect(); themeObserver = null; }
  }

  // ---------- 放行（两种模式共用） ----------
  // ★ 最短展示时长 min_show：Turnstile 测试密钥/无感验证会"秒过"，
  //   如果拿 token 就立刻放行，卡片只闪一下（观感像页面白屏抖了一下）。
  //   记录门出现的时刻，放行时至少补齐这段时间，节奏才稳。
  var shownAt = 0;

  function pass() {
    if (state === 'passed' || state === 'out') return;
    state = 'passed';

    markPassed();
    window.__humanGateVerified = true;
    stopTimers();

    root.classList.remove('is-verifying');
    root.classList.add('is-passed');

    if (TS_ON) {
      // Turnstile 模式：藏掉组件，结果行打勾
      if (twBox) twBox.classList.add('is-gone');
      if (resultLabel) resultLabel.textContent = CFG.success || '验证通过';
      if (statusEl) statusEl.hidden = true;
      if (escapeBtn) escapeBtn.hidden = true;
    } else if (label) {
      label.textContent = CFG.success || '验证通过';
      btn.disabled = true;
      btn.setAttribute('aria-label', (CFG.success || '验证通过'));
    }

    var hold = num(CFG.hold_time, 900);
    var fade = num(CFG.fade_time, 620);

    // 补足最短展示时间（从门入场算起）
    var minShow = num(CFG.min_show, 1200);
    var shown = shownAt ? (Date.now() - shownAt) : minShow;
    var wait = Math.max(hold, minShow - shown);

    setTimeout(function () {
      if (state === 'out') return;
      state = 'out';
      // 此刻才通知欢迎弹层进场：门正在淡出，8~百毫秒后欢迎卡滑入，
      // 两层一收一放正好接上，不会叠在一起
      emitVerified();
      root.classList.add('is-out');
      unlockScroll();
      setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
      }, fade + 120);
    }, wait);
  }

  // ---------- Turnstile：token → 服务端复核 ----------
  function onToken(token) {
    if (state !== 'wait' && state !== 'verifying') return;
    state = 'verifying';
    root.classList.add('is-verifying');

    // 结果行先转圈，提示"正在复核"
    if (resultLabel) resultLabel.textContent = TS.verifying_text || '正在复核验证结果…';
    var resultBox = root.querySelector('.human-gate-result');
    if (resultBox) resultBox.hidden = false;

    var url = TS.verify_url;
    if (!url) { pass(); return; }   // 没配复核地址：只信前端 token（不推荐）

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token })
    }).then(function (res) {
      if (!res.ok && res.status !== 403 && res.status !== 429) {
        throw new Error('HTTP ' + res.status);
      }
      return res.json().catch(function () { return null; });
    }).then(function (data) {
      if (state !== 'verifying') return;
      if (data && data.ok === true) {
        pass();
        return;
      }
      // 复核不通过（伪造/过期/重放 token）
      showStatus(TS.fail_text || '验证没通过，请再试一次', true);
      resetWidget();
      state = 'wait';
      root.classList.remove('is-verifying');
      if (resultBox) resultBox.hidden = true;
    }).catch(function (err) {
      // 复核服务连不上（比如 Worker 临时故障）：token 是真组件发的，
      // 放人进来，别把真人锁在门外；详细原因进控制台排障
      if (window.console) console.warn('[human-gate] 复核服务不可达，按前端 token 放行：', err);
      pass();
    });
  }

  function resetWidget() {
    try {
      if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
    } catch (err) { /* 重置失败就算了 */ }
  }

  // ---------- Turnstile：加载与渲染 ----------
  function currentTheme() {
    try {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    } catch (err) {
      return 'light';
    }
  }

  function renderWidget() {
    if (!window.turnstile || !twBox) return;
    try {
      widgetId = window.turnstile.render(twBox, {
        sitekey: TS.sitekey,
        theme: currentTheme(),
        size: 'flexible',
        language: TS.language || 'zh-cn',
        callback: onToken,
        'error-callback': function () {
          showStatus(TS.fail_text || '验证出错了，请再试一次', true);
          return true;   // 已处理，组件内部不再重复提示
        },
        'expired-callback': function () {
          resetWidget();   // token 过期，重新来一次
        },
        'timeout-callback': function () {
          // 组件自己超时（多见于交互挑战太久没动作）：给逃生门
          offerEscape();
        }
      });
    } catch (err) {
      if (window.console) console.warn('[human-gate] Turnstile 渲染失败：', err);
      offerEscape();
    }
  }

  // 主题切换（昼↔夜）时组件跟着换肤。
  // ★ 只监听"用户主动点击昼夜按钮"之后的变化：本站 body-end.swig 在
  //   页面加载时也会写一次 data-theme，如果不做窗口限制，就会和
  //   Turnstile 的渲染时机撞车——出现组件闪一下、甚至两个 iframe 叠着。
  //   做法：记录首帧的主题底色，只有它真正改变（用户切了主题）才重渲染。
  function watchTheme() {
    if (!window.MutationObserver) return;

    var baseTheme = currentTheme();
    var settled = false;
    // 给页面自身的初始化留一个窗口期，这段时间内的变化一律不算"用户切换"
    setTimeout(function () { settled = true; }, num(TS.theme_settle, 1500));

    themeObserver = new MutationObserver(function () {
      if (!settled) return;                          // 页面初始化阶段，忽略
      if (widgetId === null || state !== 'wait') return;
      var theme = currentTheme();
      if (theme === baseTheme) return;               // 没真的变（重复写入），忽略
      baseTheme = theme;
      try {
        window.turnstile.remove(widgetId);
      } catch (err) { /* 移除失败就叠着重渲染，少见且无害 */ }
      widgetId = null;
      renderWidget();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  // api.js 加载成功 → 显式渲染；加载失败 → 逃生门
  window.__hgTsOnload = function () {
    renderWidget();
    watchTheme();

    // 轮询确认挑战 iframe 真的挂出来了：api.js 能加载但 iframe 迟迟
    // 不出现（国内部分网络的表现）同样要给逃生门
    var deadline = Date.now() + num(TS.load_timeout, 8000);
    iframeTimer = setInterval(function () {
      if (state === 'passed' || state === 'out') { stopTimers(); return; }
      if (twBox && twBox.querySelector('iframe')) {
        stopTimers();   // 组件活着，正常等用户完成验证
        return;
      }
      if (Date.now() > deadline) {
        stopTimers();
        offerEscape();
      }
    }, 400);
  };

  function loadTurnstile() {
    var head = document.head;
    if (head) {
      var pc = document.createElement('link');
      pc.rel = 'preconnect';
      pc.href = 'https://challenges.cloudflare.com';
      pc.setAttribute('crossorigin', '');
      head.appendChild(pc);
    }

    var scriptEl = document.createElement('script');
    scriptEl.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      + '?render=explicit&onload=__hgTsOnload';
    scriptEl.async = true;
    scriptEl.onerror = function () {
      // challenges.cloudflare.com 连不上（国内部分网络）：给逃生门
      offerEscape();
    };
    head.appendChild(scriptEl);

    // api.js 整体加载超时兜底（onload 没回来也没报错的黑洞场景）
    setTimeout(function () {
      if (state === 'wait' && widgetId === null
        && !(twBox && twBox.querySelector('iframe'))) {
        offerEscape();
      }
    }, num(TS.load_timeout, 8000) + 2000);
  }

  // ---------- 国内逃生门 ----------
  // 只在"组件加载不出来"时出现；strict 模式完全不提供（国内访客只能等
  // 60 秒全局兜底，一般不建议）。点了走一遍装饰验证流程，本会话记住。
  function offerEscape() {
    if (!TS_ON) return;
    if (TS.china_fallback === 'strict') return;
    if (state === 'passed' || state === 'out') return;
    if (!escapeBtn || !escapeBtn.hidden) return;
    escapeBtn.hidden = false;
    try { escapeBtn.focus({ preventScroll: true }); } catch (err) { /* 焦点给不上就算了 */ }
  }

  function escapeVerify() {
    if (state !== 'wait') return;
    state = 'verifying';
    root.classList.add('is-verifying');

    // 装饰流程复刻：转圈 + 一句小字，然后放行
    var resultBox = root.querySelector('.human-gate-result');
    if (resultBox) resultBox.hidden = false;
    if (resultLabel) resultLabel.textContent = TS.passing_text || '正在放行…';

    if (REDUCE) { pass(); return; }

    var min = Math.min(num(CFG.verify_min, 900), 700);
    setTimeout(pass, min + Math.random() * 400);
  }

  // ---------- 装饰模式（turnstile 关闭 / 未配 sitekey 的回退） ----------
  function decorativeVerify() {
    if (state !== 'wait') return;
    state = 'verifying';
    root.classList.add('is-verifying');
    btn.disabled = true;

    if (REDUCE) { pass(); return; }

    var lines = CFG.verify_lines || [];
    if (lines.length > 1) {
      var last = -1;
      lineTimer = setInterval(function () {
        var i;
        do {
          i = Math.floor(Math.random() * lines.length);
        } while (i === last);
        last = i;
        label.textContent = lines[i];
      }, num(CFG.verify_line_interval, 620));
    }

    var min = num(CFG.verify_min, 900);
    var max = Math.max(num(CFG.verify_max, 1600), min);
    setTimeout(pass, min + Math.random() * (max - min));
  }

  // ---------- 启动 ----------
  function show() {
    document.body.appendChild(root);
    btn = root.querySelector('.human-gate-check');
    label = root.querySelector('.human-gate-check .human-gate-label');
    resultLabel = root.querySelector('.human-gate-result .human-gate-label');
    statusEl = root.querySelector('.human-gate-status');
    escapeBtn = root.querySelector('.human-gate-escape');
    twBox = root.querySelector('.human-gate-tw');

    // DOM 不完整（理论上不会发生，但拦路组件不能赌）：直接拆门放行
    if (TS_ON && (!twBox || !resultLabel)) {
      if (root.parentNode) root.parentNode.removeChild(root);
      window.__humanGateVerified = true;
      emitVerified();
      return;
    }
    if (!TS_ON && (!btn || !label)) {
      if (root.parentNode) root.parentNode.removeChild(root);
      window.__humanGateVerified = true;
      emitVerified();
      return;
    }

    // 保险先注册、后锁滚动：万一中间哪步抛异常，60 秒后也能自动放行，
    // 不会把访客永久锁在外面。它只负责"救急"，不替看得慢的人做决定。
    setTimeout(function () {
      if (state === 'wait' || state === 'verifying') pass();
    }, 60000);

    lockScroll();

    if (TS_ON) {
      if (escapeBtn) escapeBtn.addEventListener('click', escapeVerify);
      loadTurnstile();
    } else {
      btn.addEventListener('click', decorativeVerify);
    }

    // 下一帧再挂 is-in，让入场过渡有得播
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.add('is-in');
        shownAt = Date.now();   // 记下门"真正露面"的时刻，供最短展示时长用
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show);
  } else {
    show();
  }
})();
