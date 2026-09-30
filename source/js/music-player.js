/**
 * 右侧悬浮音乐播放器 —— 运行逻辑
 * ------------------------------------------------------------
 * - 依赖：无。只用原生 <audio>，不引入任何第三方播放器库
 * - 歌单：读取 /music/playlist.json（由 scripts/music-playlist.js 构建时生成）
 * - 骨架：由 scripts/music-player-inject.js 注入（DOM 结构见该文件）
 * - 状态：挂在 #music-player 的 data-* 上（data-state / data-playing / data-mode /
 *         data-vol / data-list），图标切换交给 CSS，JS 不重建 DOM
 * - 持久化：localStorage 记住音量、播放模式、上次听的歌与进度
 * - 自动播放：浏览器策略会拦截无交互的播放，被拦时静默停在暂停态，
 *            点一下 ▶ 即可，不做弹窗骚扰
 * - 加了 Media Session，系统媒体键/锁屏能看到当前歌曲
 */

(function () {
  'use strict';

  var root = document.getElementById('music-player');
  if (!root) return;

  var audio = root.querySelector('.mp-audio');
  var toggle = root.querySelector('.mp-toggle');
  var panel = root.querySelector('.mp-panel');
  var btnMin = root.querySelector('.mp-min');
  var coverImg = root.querySelector('.mp-cover');
  var songEl = root.querySelector('.mp-song');
  var artistEl = root.querySelector('.mp-artist');
  var discEl = root.querySelector('.mp-disc');
  var timeCur = root.querySelector('.mp-time-cur');
  var timeDur = root.querySelector('.mp-time-dur');
  var seekBar = root.querySelector('.mp-bar[data-role="seek"]');
  var seekFill = seekBar.querySelector('.mp-bar-fill');
  var seekKnob = seekBar.querySelector('.mp-bar-knob');
  var seekBuf = seekBar.querySelector('.mp-bar-buffer');
  var volBar = root.querySelector('.mp-bar[data-role="volume"]');
  var volFill = volBar.querySelector('.mp-bar-fill');
  var volKnob = volBar.querySelector('.mp-bar-knob');
  var volNum = root.querySelector('.mp-vol-num');
  var listEl = root.querySelector('.mp-list');
  var btnPlay = root.querySelector('[data-act="play"]');

  var STORAGE_KEY = 'music-player:v1';
  var MODES = ['list', 'single', 'shuffle'];
  var MODE_TITLE = { list: '列表循环', single: '单曲循环', shuffle: '随机播放' };

  var tracks = [];
  var index = 0;
  var mode = 'list';
  var listOpen = false;
  var items = [];          // 播放列表里的 DOM 节点

  // ---------- 状态读写 ----------
  function loadStored() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { raw = null; }
    return raw && typeof raw === 'object' ? raw : {};
  }
  var stored = loadStored();

  function save(extra) {
    var data = {
      index: index,
      mode: mode,
      listOpen: listOpen,
      volume: audio.muted ? 0 : audio.volume,
      muted: audio.muted,
      playing: root.getAttribute('data-playing') === '1',
      time: isFinite(audio.currentTime) ? Math.floor(audio.currentTime) : 0,
      track: tracks[index] ? tracks[index].src : ''
    };
    if (extra) {
      for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) data[k] = extra[k]; }
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function setAttr(name, value) { root.setAttribute(name, value); }

  function setPlaying(on) {
    setAttr('data-playing', on ? '1' : '0');
    discEl.classList.toggle('is-playing', on);
    toggle.classList.toggle('is-playing', on);
    btnPlay.setAttribute('aria-label', on ? '暂停' : '播放');
    if (on) {
      seekBar.setAttribute('aria-valuetext', fmt(audio.currentTime) + ' / ' + fmt(audio.duration));
    }
  }

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  // ---------- 封面占位图（没有任何封面时用） ----------
  var FALLBACK_COVER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">'
    + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0" stop-color="#ffc6dc"/><stop offset="1" stop-color="#a8c6ff"/>'
    + '</linearGradient></defs>'
    + '<rect width="200" height="200" fill="url(#g)"/>'
    + '<g fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".92">'
    + '<path d="M78 130V72l50-10v54"/><circle cx="66" cy="132" r="14"/><circle cx="116" cy="122" r="14"/>'
    + '</g></svg>'
  );

  // ---------- 渲染 ----------
  function renderMeta() {
    var t = tracks[index];
    if (!t) return;
    songEl.textContent = t.title;
    songEl.title = t.title;
    artistEl.textContent = t.artist || '未知歌手';
    coverImg.src = t.cover || FALLBACK_COVER;
    coverImg.alt = t.title + ' 封面';
    updateMediaSession(t);
  }

  function highlight() {
    for (var i = 0; i < items.length; i++) {
      var on = i === index;
      items[i].classList.toggle('is-current', on);
      if (on) {
        items[i].setAttribute('aria-current', 'true');
      } else {
        items[i].removeAttribute('aria-current');
      }
    }
    var cur = items[index];
    if (cur && listOpen && cur.scrollIntoView) {
      cur.scrollIntoView({ block: 'nearest' });
    }
  }

  function renderList() {
    listEl.innerHTML = '';
    items = [];
    var frag = document.createDocumentFragment();
    tracks.forEach(function (t, i) {
      var li = document.createElement('li');
      li.className = 'mp-item';
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');

      var idx = document.createElement('span');
      idx.className = 'mp-item-index';
      idx.textContent = i + 1;

      var box = document.createElement('span');
      box.className = 'mp-item-text';

      var name = document.createElement('span');
      name.className = 'mp-item-title';
      name.textContent = t.title;

      var who = document.createElement('span');
      who.className = 'mp-item-artist';
      who.textContent = t.artist || '未知歌手';

      box.appendChild(name);
      box.appendChild(who);
      li.appendChild(idx);
      li.appendChild(box);
      li.addEventListener('click', function () { loadTrack(i, true); });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          loadTrack(i, true);
        }
      });
      frag.appendChild(li);
      items.push(li);
    });
    listEl.appendChild(frag);
  }

  function updateMediaSession(t) {
    if (!('mediaSession' in navigator) || typeof window.MediaMetadata !== 'function') return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: t.title,
        artist: t.artist || '未知歌手',
        album: 'Ascend Log',
        artwork: t.cover ? [{ src: t.cover }] : []
      });
    } catch (e) { /* 部分浏览器对 artwork 校验严格，失败不影响播放 */ }
  }

  // ---------- 播放控制 ----------
  function loadTrack(i, autoplay) {
    if (!tracks.length) return;
    index = (i + tracks.length) % tracks.length;
    var t = tracks[index];
    resetProgress();          // 换歌后进度条立刻归零，不等第一次 timeupdate
    audio.src = t.src;
    renderMeta();
    highlight();
    if (autoplay) play();
    save();
  }

  function resetProgress() {
    seekFill.style.width = '0%';
    seekKnob.style.left = '0%';
    timeCur.textContent = '0:00';
    timeDur.textContent = '0:00';
    seekBar.setAttribute('aria-valuenow', 0);
    seekBar.setAttribute('aria-valuetext', '0:00');
  }

  function play() {
    var p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        // 自动播放被浏览器策略拦下：保持暂停态即可，不弹提示打扰
        setPlaying(false);
      });
    }
  }

  function pause() { audio.pause(); }

  function next() {
    if (!tracks.length) return;
    if (mode === 'shuffle' && tracks.length > 1) {
      var r = index;
      while (r === index) r = Math.floor(Math.random() * tracks.length);
      loadTrack(r, true);
      return;
    }
    loadTrack(index + 1, true);   // 列表循环：到末尾自动回到第一首
  }

  function prev() {
    if (!tracks.length) return;
    if (audio.currentTime > 3) {                 // 播过 3 秒：先回到本曲开头
      audio.currentTime = 0;
      return;
    }
    if (mode === 'shuffle' && tracks.length > 1) {
      var r = index;
      while (r === index) r = Math.floor(Math.random() * tracks.length);
      loadTrack(r, true);
      return;
    }
    loadTrack(index - 1, true);
  }

  function cycleMode() {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    setAttr('data-mode', mode);
    root.querySelector('[data-act="mode"]').title = MODE_TITLE[mode];
    save();
  }

  function setVolume(v, fromUser) {
    v = Math.max(0, Math.min(1, v));
    audio.volume = v;
    if (v > 0) audio.muted = false;
    applyVolumeUI(v, audio.muted);
    if (fromUser) save();
  }

  function applyVolumeUI(v, muted) {
    var shown = muted ? 0 : v;
    volFill.style.width = (shown * 100) + '%';
    volKnob.style.left = (shown * 100) + '%';
    volNum.textContent = Math.round(shown * 100);
    volBar.setAttribute('aria-valuenow', Math.round(shown * 100));
    setAttr('data-vol', muted || v === 0 ? 'mute' : (v < 0.5 ? 'low' : 'high'));
  }

  function openPanel(open) {
    setAttr('data-state', open ? 'open' : 'collapsed');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? '收起音乐播放器' : '打开音乐播放器');
  }

  function toggleList(open) {
    listOpen = typeof open === 'boolean' ? open : !listOpen;
    setAttr('data-list', listOpen ? 'open' : 'closed');
    root.querySelector('[data-act="list"]').classList.toggle('is-active', listOpen);
    root.querySelector('[data-act="list"]').setAttribute('aria-expanded', listOpen ? 'true' : 'false');
    if (listOpen) highlight();
    save();
  }

  // ---------- 进度 / 音量拖拽（统一处理 pointer 事件） ----------
  function bindDrag(bar, onRatio, isSeeking) {
    var dragging = false;

    function ratioOf(e) {
      var rect = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    }

    function onDown(e) {
      if (!tracks.length) return;
      dragging = true;
      bar.classList.add('is-dragging');
      try { bar.setPointerCapture(e.pointerId); } catch (err) { /* 老浏览器忽略 */ }
      var r = ratioOf(e);
      if (isSeeking) previewSeek(r);
      onRatio(r);
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      var r = ratioOf(e);
      if (isSeeking) previewSeek(r);
      onRatio(r);
    }

    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      bar.classList.remove('is-dragging');
      try { bar.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }

    bar.addEventListener('pointerdown', onDown);
    bar.addEventListener('pointermove', onMove);
    bar.addEventListener('pointerup', onUp);
    bar.addEventListener('pointercancel', onUp);

    // 键盘无障碍：←/→ 微调
    bar.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 10 : 2;
      var cur = isSeeking
        ? (audio.duration ? audio.currentTime / audio.duration : 0)
        : audio.volume;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        var mr = Math.min(1, cur + step / 100);
        if (isSeeking) previewSeek(mr);
        onRatio(mr);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        var ml = Math.max(0, cur - step / 100);
        if (isSeeking) previewSeek(ml);
        onRatio(ml);
      }
    });
  }

  function previewSeek(ratio) {
    seekFill.style.width = (ratio * 100) + '%';
    seekKnob.style.left = (ratio * 100) + '%';
    var d = audio.duration;
    if (d) {
      var t = ratio * d;
      timeCur.textContent = fmt(t);
      seekBar.setAttribute('aria-valuenow', Math.round(ratio * 100));
      seekBar.setAttribute('aria-valuetext', fmt(t) + ' / ' + fmt(d));
    }
  }

  // ---------- 事件绑定 ----------
  toggle.addEventListener('click', function () {
    openPanel(root.getAttribute('data-state') !== 'open');
  });
  btnMin.addEventListener('click', function () { openPanel(false); });

  root.querySelector('[data-act="play"]').addEventListener('click', function () {
    if (!tracks.length) return;
    if (audio.paused) play(); else pause();
  });
  root.querySelector('[data-act="prev"]').addEventListener('click', prev);
  root.querySelector('[data-act="next"]').addEventListener('click', next);
  root.querySelector('[data-act="mode"]').addEventListener('click', cycleMode);
  root.querySelector('[data-act="list"]').addEventListener('click', function () { toggleList(); });
  root.querySelector('[data-act="mute"]').addEventListener('click', function () {
    audio.muted = !audio.muted;
    applyVolumeUI(audio.volume, audio.muted);
    save();
  });

  // 面板打开时阻止空格滚动页面（空格 = 播放/暂停）
  panel.addEventListener('keydown', function (e) {
    if (e.key === ' ' && e.target === panel) {
      e.preventDefault();
      if (audio.paused) play(); else pause();
    }
  });

  // 点击面板以外区域自动收起（音乐继续播）
  document.addEventListener('pointerdown', function (e) {
    if (root.getAttribute('data-state') !== 'open') return;
    if (root.contains(e.target)) return;
    openPanel(false);
    if (listOpen) toggleList(false);
  }, { passive: true });

  bindDrag(seekBar, function (r) {
    if (audio.duration) audio.currentTime = r * audio.duration;
  }, true);

  bindDrag(volBar, function (r) { setVolume(r, true); }, false);

  // ---------- audio 事件 ----------
  audio.addEventListener('play', function () { setPlaying(true); save(); });
  audio.addEventListener('pause', function () { setPlaying(false); save(); });
  audio.addEventListener('ended', function () {
    if (mode === 'single') {
      audio.currentTime = 0;
      play();
    } else {
      next();
    }
  });
  audio.addEventListener('loadedmetadata', function () {
    timeDur.textContent = fmt(audio.duration);
  });
  var lastSavedSec = -1;
  audio.addEventListener('timeupdate', function () {
    var d = audio.duration;
    if (!d) return;
    var r = audio.currentTime / d;
    if (!seekBar.classList.contains('is-dragging')) {
      seekFill.style.width = (r * 100) + '%';
      seekKnob.style.left = (r * 100) + '%';
      timeCur.textContent = fmt(audio.currentTime);
      seekBar.setAttribute('aria-valuenow', Math.round(r * 100));
      seekBar.setAttribute('aria-valuetext', fmt(audio.currentTime) + ' / ' + fmt(d));
    }
    var sec = Math.floor(audio.currentTime);        // 每 5 秒记一次进度，不必每帧写 localStorage
    if (sec % 5 === 0 && sec !== lastSavedSec) {
      lastSavedSec = sec;
      save();
    }
  });
  audio.addEventListener('progress', function () {
    var d = audio.duration;
    if (!d || !audio.buffered.length) return;
    seekBuf.style.width = Math.min(100, (audio.buffered.end(audio.buffered.length - 1) / d) * 100) + '%';
  });
  // 某一首放不出来（文件缺失/格式不支持）时跳到下一首，避免卡死在坏文件上
  audio.addEventListener('error', function () {
    if (!tracks.length) return;
    setPlaying(false);
    if (tracks.length > 1 && !audio.dataset.errSkipped) {
      audio.dataset.errSkipped = '1';
      setTimeout(function () { audio.dataset.errSkipped = ''; next(); }, 600);
    } else {
      artistEl.textContent = '这首播不出来（文件缺失或格式不支持）';
    }
  });

  // 系统媒体键
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', next);
    } catch (e) { /* 不支持的动作忽略 */ }
  }

  // ---------- 空歌单兜底 ----------
  function onceMetadata(fn) {
    if (audio.readyState >= 1) { fn(); return; }
    audio.addEventListener('loadedmetadata', function onMeta() {
      audio.removeEventListener('loadedmetadata', onMeta);
      fn();
    });
  }

  function showEmpty() {
    songEl.textContent = '还没有歌曲';
    artistEl.textContent = '把 mp3 放进 source/music/ 后重新构建';
    coverImg.src = FALLBACK_COVER;
    ['play', 'prev', 'next', 'mode', 'list'].forEach(function (a) {
      var b = root.querySelector('[data-act="' + a + '"]');
      if (b) b.disabled = true;
    });
    var tip = document.createElement('div');
    tip.className = 'mp-empty';
    tip.innerHTML = '用法：把音频文件丢进 <code>source/music/</code>，'
      + '文件名写成「歌手 - 歌名.mp3」，同名图片会自动当封面；'
      + '然后重新构建（<code>npm run build</code>）。';
    panel.insertBefore(tip, listEl);
  }

  // ---------- 初始化 ----------
  function init() {
    // 音量 / 模式 / 面板状态：先恢复上次的偏好
    mode = MODES.indexOf(stored.mode) !== -1 ? stored.mode : 'list';
    setAttr('data-mode', mode);
    root.querySelector('[data-act="mode"]').title = MODE_TITLE[mode];

    var vol = typeof stored.volume === 'number' ? stored.volume : 0.7;
    audio.muted = stored.muted === true;
    setVolume(vol, false);
    if (stored.muted) applyVolumeUI(vol, true);

    if (stored.listOpen) toggleList(true);
    openPanel(false);   // 每次进站先收起，避免挡正文

    var url = root.getAttribute('data-playlist');
    if (!url) return;

    fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        tracks = (data && Array.isArray(data.tracks)) ? data.tracks.filter(function (t) { return t && t.src; }) : [];
        if (!tracks.length) { showEmpty(); return; }

        renderList();

        // 优先回到上次听的那首；找不到就用存的下标
        var start = 0;
        if (stored.track) {
          var hit = tracks.findIndex(function (t) { return t.src === stored.track; });
          if (hit >= 0) start = hit;
        } else if (typeof stored.index === 'number' && stored.index < tracks.length) {
          start = stored.index;
        }

        index = start;
        audio.src = tracks[index].src;
        renderMeta();
        highlight();

        // 恢复上次的进度：等元数据就绪再 seek，否则浏览器会忽略这次跳转
        var resume = typeof stored.time === 'number' ? stored.time : 0;
        if (resume > 3) {
          onceMetadata(function () {
            try { audio.currentTime = Math.min(resume, Math.max(0, (audio.duration || resume) - 1)); } catch (e) { /* ignore */ }
          });
        }

        if (stored.playing) play();   // 被浏览器策略拦下就停在暂停态
      })
      .catch(function () {
        songEl.textContent = '歌单读取失败';
        artistEl.textContent = '本地预览请让服务指向已构建的 public 目录';
      });
  }

  init();
})();
