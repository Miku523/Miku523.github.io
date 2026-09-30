/**
 * Live2D 看板娘聊天面板：博丽灵梦 AI 对话
 * ============================================================
 * 依赖：
 *   - /js/reimu-live2d.js（点她会派发 window 事件 'reimu:tap'）
 *   - Cloudflare Worker 后端（见仓库 cloudflare/reimu-chat-worker.js）
 *     API Key 存在 Worker 里，前端不接触任何密钥
 *
 * 接入步骤：把下面 CONFIG.WORKER_URL 换成你部署好的 Worker 地址即可。
 * 临时调试：在网址后加 ?reimu_ai=<Worker地址> 可临时指定后端，不改文件。
 *
 * 特性：
 *   - 点击看板娘本体打开 / 关闭面板
 *   - 对话历史存 localStorage（最多保留 40 条）
 *   - 回复逐字显示；网络/额度/限流错误都有中文提示
 *   - 跟随站点昼夜模式；<900px 移动端不启用（与看板娘一致）
 */
(function () {
  'use strict';

  var CONFIG = {
    WORKER_URL: 'https://chat.mikuascendlog.com/chat',  // Cloudflare Worker 自有域名（workers.dev 国内被墙，不能用）
    MAX_HISTORY: 40,           // localStorage 里最多保留多少条消息
    API_MESSAGES: 12,          // 每次请求最多带多少条上下文
    TYPE_SPEED: 16,            // 回复逐字显示的间隔（ms）
    GREETINGS: [
      '哦，有人来了。我是博丽灵梦，这座博客的看板娘。想问什么？',
      '又是你啊。有事就说吧，别磨蹭。',
      '欢迎，随便逛逛吧。想聊天的话我也不是不能陪你。'
    ]
  };

  // ---------- 环境守卫 ----------
  if (window.innerWidth < 900) return;

  var endpoint = (function () {
    var debug = new URLSearchParams(location.search).get('reimu_ai');
    if (debug) return debug;
    if (CONFIG.WORKER_URL) return CONFIG.WORKER_URL;
    return localStorage.getItem('reimu_ai_endpoint') || '';
  })();

  var STORE_KEY = 'reimu-chat-history';
  var history = loadHistory();
  var busy = false;

  // ---------- 样式（内联注入，免 main.css 缓存影响；跟随昼夜模式） ----------
  var style = document.createElement('style');
  style.id = 'reimu-chat-style';
  style.textContent = [
    '.rc-panel{position:fixed;left:10px;width:330px;max-width:calc(100vw - 20px);',
    '  display:none;flex-direction:column;border-radius:16px;overflow:hidden;z-index:1201;',
    '  background:rgba(255,255,255,.86);backdrop-filter:blur(14px) saturate(1.4);',
    '  -webkit-backdrop-filter:blur(14px) saturate(1.4);',
    '  border:1px solid rgba(228,120,160,.28);box-shadow:0 12px 36px rgba(120,60,90,.18);',
    '  font-family:inherit;transition:opacity .25s ease,transform .25s ease;}',
    '.rc-panel.is-open{display:flex;}',
    '[data-theme="dark"] .rc-panel{background:rgba(32,30,38,.88);border-color:rgba(228,120,160,.32);',
    '  box-shadow:0 12px 36px rgba(0,0,0,.45);}',
    '.rc-head{display:flex;align-items:center;gap:8px;padding:10px 12px;',
    '  background:linear-gradient(135deg,rgba(226,90,120,.92),rgba(196,64,96,.92));color:#fff;}',
    '.rc-avatar{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.22);',
    '  display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;}',
    '.rc-title{font-size:14px;font-weight:600;letter-spacing:.5px;}',
    '.rc-sub{font-size:11px;opacity:.82;margin-left:auto;}',
    '.rc-close{background:none;border:0;color:#fff;font-size:16px;cursor:pointer;line-height:1;',
    '  padding:2px 4px;opacity:.85;}',
    '.rc-close:hover{opacity:1;}',
    '.rc-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:9px;',
    '  max-height:320px;scrollbar-width:thin;}',
    '.rc-msg{max-width:84%;padding:8px 11px;border-radius:13px;font-size:13px;line-height:1.65;',
    '  white-space:pre-wrap;word-break:break-word;}',
    '.rc-msg.bot{align-self:flex-start;background:rgba(244,238,242,.96);color:#3a3338;',
    '  border-bottom-left-radius:4px;}',
    '.rc-msg.me{align-self:flex-end;background:linear-gradient(135deg,#e2506f,#c74060);color:#fff;',
    '  border-bottom-right-radius:4px;}',
    '[data-theme="dark"] .rc-msg.bot{background:rgba(58,54,64,.95);color:#ece8ee;}',
    '.rc-msg.sys{align-self:center;background:rgba(0,0,0,.05);color:#8b8290;font-size:12px;',
    '  border-radius:9px;text-align:center;}',
    '[data-theme="dark"] .rc-msg.sys{background:rgba(255,255,255,.08);color:#a79fb0;}',
    '.rc-dots span{display:inline-block;width:5px;height:5px;margin:0 1.5px;border-radius:50%;',
    '  background:#c07a92;animation:rc-bounce 1.2s infinite;}',
    '.rc-dots span:nth-child(2){animation-delay:.15s}.rc-dots span:nth-child(3){animation-delay:.3s}',
    '@keyframes rc-bounce{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-4px);opacity:1}}',
    '.rc-foot{display:flex;gap:7px;padding:9px 10px;border-top:1px solid rgba(150,110,130,.16);',
    '  background:rgba(255,255,255,.5);}',
    '[data-theme="dark"] .rc-foot{background:rgba(255,255,255,.04);border-top-color:rgba(255,255,255,.09);}',
    '.rc-input{flex:1;resize:none;height:38px;max-height:88px;padding:9px 11px;font-size:13px;',
    '  font-family:inherit;border-radius:10px;border:1px solid rgba(180,140,160,.35);',
    '  background:rgba(255,255,255,.9);color:#3a3338;outline:none;line-height:1.4;}',
    '[data-theme="dark"] .rc-input{background:rgba(255,255,255,.07);color:#ece8ee;border-color:rgba(255,255,255,.14);}',
    '.rc-input:focus{border-color:#e2506f;}',
    '.rc-send{width:60px;border:0;border-radius:10px;cursor:pointer;font-size:13px;color:#fff;',
    '  background:linear-gradient(135deg,#e2506f,#c74060);font-family:inherit;}',
    '.rc-send:disabled{opacity:.5;cursor:not-allowed;}',
    /* 点击提示气泡：首次访问浮在她旁边 */
    '.rc-tip{position:fixed;left:74px;padding:6px 11px;border-radius:12px;font-size:12px;',
    '  background:rgba(255,255,255,.94);color:#a2415f;border:1px solid rgba(226,90,120,.3);',
    '  box-shadow:0 6px 18px rgba(120,60,90,.16);z-index:1202;cursor:pointer;',
    '  animation:rc-float 2.6s ease-in-out infinite;}',
    '[data-theme="dark"] .rc-tip{background:rgba(40,36,44,.94);color:#f0a8bd;}',
    '@keyframes rc-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}'
  ].join('\n');
  document.head.appendChild(style);

  // ---------- DOM ----------
  var panel = document.createElement('div');
  panel.className = 'rc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '与博丽灵梦聊天');
  panel.innerHTML = [
    '<div class="rc-head">',
    '  <span class="rc-avatar">灵</span>',
    '  <span class="rc-title">博丽灵梦</span>',
    '  <span class="rc-sub">看板娘</span>',
    '  <button class="rc-close" type="button" aria-label="关闭聊天">&#10005;</button>',
    '</div>',
    '<div class="rc-body" id="rc-body"></div>',
    '<div class="rc-foot">',
    '  <textarea class="rc-input" rows="1" placeholder="和灵梦说点什么…" maxlength="500"></textarea>',
    '  <button class="rc-send" type="button">发送</button>',
    '</div>'
  ].join('');
  document.body.appendChild(panel);

  var body = panel.querySelector('#rc-body');
  var input = panel.querySelector('.rc-input');
  var sendBtn = panel.querySelector('.rc-send');
  var closeBtn = panel.querySelector('.rc-close');

  // 位置：贴在看板娘头顶（模型包围盒上部有透明留白，取 0.8 高度避开）
  function layout() {
    var canvas = document.querySelector('canvas.reimu-live2d');
    var h = canvas ? canvas.getBoundingClientRect().height : Math.min(380, window.innerHeight * 0.42);
    var panelBottom = Math.round(h * 0.8 + 14);
    var avail = window.innerHeight - panelBottom - 20;
    panel.style.bottom = panelBottom + 'px';
    panel.style.maxHeight = Math.max(200, Math.min(460, avail)) + 'px';
    panel.querySelector('.rc-body').style.maxHeight = Math.max(120, Math.min(320, avail - 100)) + 'px';
  }
  layout();
  window.addEventListener('resize', layout);

  // ---------- 渲染 ----------
  function bubble(text, who) {
    var el = document.createElement('div');
    el.className = 'rc-msg ' + who;
    if (who === 'bot') {
      el.innerHTML = linkify(escapeHtml(text));
    } else {
      el.textContent = text;
    }
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // 博客地址自动变成可点链接
  function linkify(s) {
    return s.replace(/(https?:\/\/[^\s<]+)/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener" style="color:#c74060">' + u + '</a>';
    });
  }

  function renderHistory() {
    body.innerHTML = '';
    if (!history.length) {
      bubble(pick(CONFIG.GREETINGS), 'bot');
      return;
    }
    history.forEach(function (m) {
      bubble(m.content, m.role === 'user' ? 'me' : 'bot');
    });
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function saveHistory() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-CONFIG.MAX_HISTORY)));
    } catch (err) { /* 隐私模式下写入失败，忽略 */ }
  }

  function loadHistory() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(function (m) {
        return m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant');
      }) : [];
    } catch (err) { return []; }
  }

  // ---------- 开关 ----------
  var opened = false;
  function open() {
    if (opened) return;
    opened = true;
    layout();
    panel.classList.add('is-open');
    hideTip();
    setTimeout(function () { input.focus(); }, 80);
  }
  function close() {
    opened = false;
    panel.classList.remove('is-open');
  }
  function toggle() { opened ? close() : open(); }

  closeBtn.addEventListener('click', close);

  // 点看板娘 → 打开聊天并播个动作
  window.addEventListener('reimu:tap', function () {
    open();
    if (window.__REIMU__ && window.__REIMU__.playMotion) window.__REIMU__.playMotion();
  });

  // Esc 收起
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && opened) close();
  });

  // ---------- 发送 ----------
  function setBusy(v) {
    busy = v;
    sendBtn.disabled = v;
    sendBtn.textContent = v ? '…' : '发送';
  }

  function typing() {
    var el = document.createElement('div');
    el.className = 'rc-msg bot rc-dots';
    el.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  // 逐字显示，像打字机一样
  function typeOut(el, text, done) {
    var i = 0;
    el.textContent = '';
    (function step() {
      if (i >= text.length) { el.innerHTML = linkify(escapeHtml(text)); if (done) done(); return; }
      el.textContent = text.slice(0, ++i);
      body.scrollTop = body.scrollHeight;
      setTimeout(step, CONFIG.TYPE_SPEED);
    })();
  }

  function send() {
    var text = input.value.trim();
    if (!text || busy) return;

    if (!endpoint) {
      bubble('还没接上我的「传声筒」（AI 后端）呢……去 cloudflare/README.md 看看怎么部署吧。', 'bot');
      return;
    }

    bubble(text, 'me');
    history.push({ role: 'user', content: text });
    saveHistory();
    input.value = '';
    input.style.height = '38px';
    setBusy(true);

    var dots = typing();
    var payload = {
      messages: history.slice(-CONFIG.API_MESSAGES).map(function (m) {
        return { role: m.role, content: m.content };
      })
    };

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    }).then(function (r) {
      dots.remove();
      if (r.ok && r.data && r.data.reply) {
        var el = bubble('', 'bot');
        typeOut(el, r.data.reply, function () {
          history.push({ role: 'assistant', content: r.data.reply });
          saveHistory();
        });
        return;
      }
      var msg = (r.data && r.data.error) || ('请求失败（' + r.status + '）');
      if (r.status === 429) msg = (r.data && r.data.error) || '你问得太快啦，让我喘口气';
      bubble(msg, 'sys');
    }).catch(function () {
      dots.remove();
      bubble('连不上神社那边……（网络错误，稍后再试）', 'sys');
    }).then(function () {
      setBusy(false);
    });
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });
  // 输入框自适应高度
  input.addEventListener('input', function () {
    input.style.height = '38px';
    input.style.height = Math.min(88, input.scrollHeight) + 'px';
  });

  renderHistory();

  // ---------- 首次访问的提示气泡 ----------
  var tip = null;
  function hideTip() {
    if (tip) { tip.remove(); tip = null; }
    try { sessionStorage.setItem('reimu-tip-done', '1'); } catch (err) { /* 忽略 */ }
  }
  (function showTip() {
    var done = false;
    try { done = sessionStorage.getItem('reimu-tip-done') === '1'; } catch (err) { /* 忽略 */ }
    if (done) return;
    setTimeout(function () {
      if (opened || window.innerWidth < 900) return;
      tip = document.createElement('div');
      tip.className = 'rc-tip';
      tip.textContent = '点我聊天 →';
      tip.addEventListener('click', open);
      document.body.appendChild(tip);
      var canvas = document.querySelector('canvas.reimu-live2d');
      var rect = canvas && canvas.getBoundingClientRect();
      var top = rect ? rect.top + rect.height * 0.34 : window.innerHeight * 0.62;
      tip.style.top = Math.round(top) + 'px';
      setTimeout(hideTip, 12000);      // 12 秒后自己消失
    }, 4200);                          // 等看板娘淡入之后再冒出来
  })();

  // 供控制台/调试使用
  window.__REIMU_CHAT__ = { open: open, close: close, toggle: toggle, endpoint: endpoint };

  // 调试参数：?reimu_demo=你好 —— 自动打开面板（带值时顺带发一条消息）
  (function demo() {
    var q = new URLSearchParams(location.search);
    if (!q.has('reimu_demo')) return;
    var text = q.get('reimu_demo');
    setTimeout(function () {
      open();
      if (text) { input.value = text; send(); }
    }, 1200);
  })();
})();
