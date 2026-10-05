// ============================================
// 联系方式防爬（contact-guard）—— 运行时
//
// 配置：source/_data/contact-guard.yml
// 注入：scripts/contact-guard.js（把明文替换成 data-cg-* 占位 + 引入本文件）
//
// 静态 HTML 里没有明文邮箱 / 连续 QQ 数字，只有：
//   data-cg-mail : "user的base64,domain的base64,tld的base64"
//   data-cg-qqv  : QQ 每位数字 +3 后拼成的串
//   data-cg-qql  : 原始位数
// 本文件在点击（或聚焦）时才把这些片段拼回真实值，用完即弃。
//
// 防的是什么：不执行 JS 的采集器、正则扫 HTML 的脚本、以及"复制链接
//   地址"（href 里始终没有明文）。
// ============================================
(function () {
  'use strict';

  var CFG = window.__CG_CONFIG__ || {};
  var emailAction = CFG.email_action === 'copy' ? 'copy' : 'mailto';

  // ---------- 解码 ----------
  function b64decode(s) {
    try {
      return decodeURIComponent(escape(atob(s)));
    } catch (err) {
      try { return atob(s); } catch (err2) { return ''; }
    }
  }

  function decodeMail(payload) {
    var parts = String(payload).split(',');
    if (parts.length !== 3) return '';
    return b64decode(parts[0]) + '@' + b64decode(parts[1]) + '.' + b64decode(parts[2]);
  }

  function decodeQQ(v, len) {
    var s = String(v);
    var n = Number(len) || 0;
    if (n && s.length !== n) return '';   // 长度对不上，别乱拼
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var d = Number(s.charAt(i));
      if (!isFinite(d)) return '';
      out += String((d + 7) % 10);        // 与注入器的 encodeQQ 相反
    }
    return out;
  }

  // ---------- 小提示条 ----------
  var tipEl = null, tipTimer = null;
  function tip(text) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'cg-tip';
      tipEl.setAttribute('role', 'status');
      document.body.appendChild(tipEl);
    }
    tipEl.textContent = text;
    tipEl.classList.add('is-on');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { tipEl.classList.remove('is-on'); }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // 老内核兜底：临时 input + execCommand
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('execCommand copy failed'));
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---------- 邮箱：点击时拼装并跳转 ----------
  function onMailClick(e) {
    var el = e.currentTarget;
    var mail = decodeMail(el.getAttribute('data-cg-mail'));
    if (!mail) return;
    e.preventDefault();

    if (emailAction === 'copy') {
      copyText(mail).then(function () {
        tip('邮箱已复制：' + mail);
      }).catch(function () {
        tip('邮箱：' + mail);   // 复制失败就直接亮出来，别让人拿不到
      });
      return;
    }

    // mailto：用 location 跳转，不写进 DOM（避免被后续快照抓到）
    try {
      window.location.href = 'mailto:' + mail;
    } catch (err) {
      tip('邮箱：' + mail);
    }
  }

  // href 在点击前一刻才写进去，点击后立刻擦掉 —— 右键复制链接拿不到明文
  function onMailDown(e) {
    var el = e.currentTarget;
    var mail = decodeMail(el.getAttribute('data-cg-mail'));
    if (mail && emailAction === 'mailto') el.setAttribute('href', 'mailto:' + mail);
  }
  function onMailUp(e) {
    var el = e.currentTarget;
    // 稍后擦除，给浏览器读取 href 的机会
    setTimeout(function () { el.setAttribute('href', '#'); }, 1200);
  }

  // ---------- QQ：点击拉起会话（或复制号） ----------
  function onQQClick(e) {
    var el = e.currentTarget;
    var qq = decodeQQ(el.getAttribute('data-cg-qqv'), el.getAttribute('data-cg-qql'));
    if (!qq) return;
    e.preventDefault();

    var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    if (isMobile) {
      // 手机端：优先拉起 QQ App（mqqwpa 协议），失败退回复制
      try {
        window.location.href = 'mqqwpa://im/chat?chat_type=wpa&uin=' + qq;
      } catch (err) { /* 忽略，下面兜底 */ }
      setTimeout(function () { tip('QQ：' + qq + '（已尝试唤起 QQ）'); }, 300);
      return;
    }

    // 桌面端：复制 QQ 号并提示，用户自己去加
    copyText(qq).then(function () {
      tip('QQ 号已复制：' + qq);
    }).catch(function () {
      tip('QQ：' + qq);
    });
  }

  // ---------- 绑定 ----------
  function bind() {
    var mails = document.querySelectorAll('[data-cg-mail]');
    for (var i = 0; i < mails.length; i++) {
      var el = mails[i];
      if (el.getAttribute('data-cg-bound') === '1') continue;
      el.setAttribute('data-cg-bound', '1');
      el.addEventListener('click', onMailClick);
      if (el.hasAttribute('href')) {
        el.addEventListener('mousedown', onMailDown);
        el.addEventListener('mouseup', onMailUp);
        el.addEventListener('touchstart', onMailDown, { passive: true });
      }
    }

    var qqs = document.querySelectorAll('[data-cg-qqv]');
    for (var j = 0; j < qqs.length; j++) {
      var q = qqs[j];
      if (q.getAttribute('data-cg-bound') === '1') continue;
      q.setAttribute('data-cg-bound', '1');
      q.addEventListener('click', onQQClick);
    }
  }

  if (CFG.block_contextmenu === true) {
    document.addEventListener('contextmenu', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('[data-cg-mail],[data-cg-qqv]')) {
        e.preventDefault();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  // pjax 换页后新内容里可能也有联系方式（当前站点联系方式在侧栏，不换，
  // 但保留这个钩子以防以后挪到正文里）
  window.addEventListener('pjax:success', bind);
})();
