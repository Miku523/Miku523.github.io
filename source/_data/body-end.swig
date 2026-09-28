<button id="darkmode-btn" aria-label="切换昼夜模式"></button>

<!-- 动态背景：纯 CSS 环境光层（柔光带 + 散景光斑，见 styles.styl 的 .bg-ambient） -->
<div class="bg-ambient" aria-hidden="true"></div>

<!-- ============================================================
     动态人物层：动画 WebP 图片（人物/发丝/衣摆自然流动）
     它是「图片」不是 <video>，浏览器与微信/QQ 内核不会嗅探出
     "下载/投屏"工具条。资源就绪后淡入覆盖静态图。
     省流模式 / 2G 网络 / 系统"减少动态效果"时不下这张图，停在 bg.png。
     固定尺寸 1152x648（8fps），想换更高画质可重新生成 source/images/bg-loop.webp。
==================================================================== -->
<div class="bg-media" aria-hidden="true">
  <img alt="" decoding="async" data-src="/images/bg-loop.webp">
</div>

<script>
(function(){
  var wrap = document.querySelector('.bg-media');
  if (!wrap) return;
  var img = wrap.querySelector('img');
  if (!img) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || {};
  var slow = conn.saveData === true || /(^|-)2g/.test(conn.effectiveType || '');
  if (reduce || slow) return;   // 省流 / 减少动效：不进这张图，停在静态背景图

  img.addEventListener('load', function(){ wrap.classList.add('is-ready'); });
  img.src = img.getAttribute('data-src');
})();
</script>

<!-- ============================================================
     视频版方案（当前停用；想换成视频版：
       styles.styl 顶部 $bg-media 改成 'video'，再取消下面两段注释）

<div class="bg-video" aria-hidden="true">
  <video muted loop playsinline autoplay preload="auto"
         poster="/images/bg.png" src="/videos/bg-loop.mp4?v=4"
         disableRemotePlayback disablePictureInPicture
         controlsList="nodownload noplaybackrate nofullscreen"
         webkit-playsinline x5-playsinline x5-video-player-type="h5" x5-video-player-fullscreen="false"></video>
</div>

<script>
(function(){
  var wrap = document.querySelector('.bg-video');
  if (!wrap) return;
  var video = wrap.querySelector('video');
  if (!video) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || {};
  var slow = conn.saveData === true || /(^|-)2g/.test(conn.effectiveType || '');
  if (reduce || slow){
    video.removeAttribute('autoplay');
    video.removeAttribute('src');
    video.load();
    return;
  }

  function reveal(){ wrap.classList.add('is-ready'); }
  if (video.readyState >= 2){ reveal(); }
  video.addEventListener('loadeddata', reveal);
  video.addEventListener('playing', reveal);

  var p = video.play();
  if (p && p.catch){ p.catch(function(){ /* 自动播放被拦，静态图兜底 */ }); }
})();
</script>
==================================================================== -->

<!-- 动态背景：落樱花瓣容器（花瓣随机参数由下面脚本生成） -->
<div class="bg-petals" aria-hidden="true"></div>

<script>
(function(){
  // 生成落樱花瓣：位置、大小、下落时长、横向漂移、旋转角都做随机，
  // 负的 animation-delay 让花瓣一进页面就已经"飘在半空"，不会集体从顶部开始
  var host = document.querySelector('.bg-petals');
  if (!host) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var count = window.innerWidth < 768 ? 10 : 22;
  var frag = document.createDocumentFragment();

  for (var i = 0; i < count; i++){
    var p = document.createElement('span');
    var size = 7 + Math.random() * 9;
    p.className = 'bg-petal';
    p.style.left = (Math.random() * 100).toFixed(2) + '%';
    p.style.width = size.toFixed(1) + 'px';
    p.style.height = (size * 0.82).toFixed(1) + 'px';
    p.style.animationDuration = (11 + Math.random() * 13).toFixed(1) + 's';
    p.style.animationDelay = (-Math.random() * 22).toFixed(1) + 's';
    p.style.setProperty('--petal-opacity', (0.5 + Math.random() * 0.45).toFixed(2));
    p.style.setProperty('--drift', (Math.random() * 180 - 90).toFixed(0) + 'px');
    p.style.setProperty('--spin', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    frag.appendChild(p);
  }
  host.appendChild(frag);
})();
</script>

<script>
(function(){
  const btn = document.getElementById('darkmode-btn');
  const html = document.documentElement;
  const storageKey = 'next-darkmode';

  function apply(dark){
    html.setAttribute('data-theme', dark ? 'dark' : 'light');
    // 图标显示"将切换到的模式"：当前夜间 → 显示太阳（点击切白天）
    btn.textContent = dark ? '☀️' : '🌙';
    btn.title = dark ? '切换到白天模式' : '切换到夜间模式';
  }

  // 读取本地保存的偏好，没有则跟随系统
  let saved = localStorage.getItem(storageKey);
  let dark;
  if (saved === null){
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    dark = saved === 'true';
  }
  apply(dark);

  btn.addEventListener('click', ()=>{
    dark = !dark;
    apply(dark);
    localStorage.setItem(storageKey, dark);
  });
})();
</script>

<!-- ============================================================
     樱花点击特效：点击 / 触摸处绽开一簇樱花花瓣
     画布由脚本动态插入，铺满视口挂在最顶层但不拦截鼠标
     （样式见 styles.styl 的 .click-sakura，$click-sakura 开关）
     系统"减少动态效果"时不启用，与背景动效的取舍保持一致
==================================================================== -->
<script>
(function(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'click-sakura';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;

  function resize(){
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // 樱花花色：白天明快粉白；夜间压深压暗，避免在暗背景上发白发亮
  var PALETTE_LIGHT = [
    [255, 183, 212], [255, 158, 187], [255, 218, 233],
    [252, 200, 222], [255, 235, 244]
  ];
  var PALETTE_DARK = [
    [226, 140, 178], [214, 125, 165], [240, 170, 200],
    [230, 155, 185], [245, 195, 220]
  ];

  var petals = [];   // 空中花瓣队列
  var ripples = [];  // 点击光环队列
  var MAX_PETALS = 220;
  var running = false;
  var lastT = 0;

  function burst(x, y){
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var palette = dark ? PALETTE_DARK : PALETTE_LIGHT;
    var count = 9 + Math.floor(Math.random() * 5);   // 每次绽放 9~13 片

    for (var i = 0; i < count; i++){
      var angle = Math.random() * Math.PI * 2;
      var speed = 60 + Math.random() * 190;
      petals.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (90 + Math.random() * 130), // 整体向上抛
        size: 6 + Math.random() * 7,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - .5) * 7,                // 旋转速度 rad/s
        swayAmp: 14 + Math.random() * 26,            // 横向摇曳幅度
        swayFreq: 1.6 + Math.random() * 2.4,         // 摇曳频率 Hz
        swayPhase: Math.random() * Math.PI * 2,
        life: 0,
        ttl: .9 + Math.random() * .7,                // 存活 0.9~1.6s
        color: palette[Math.floor(Math.random() * palette.length)],
        baseAlpha: .82 + Math.random() * .18
      });
    }

    ripples.push({ x: x, y: y, life: 0, ttl: .32 });

    if (petals.length > MAX_PETALS) petals.splice(0, petals.length - MAX_PETALS);

    if (!running){
      running = true;
      lastT = performance.now();
      requestAnimationFrame(tick);
    }
  }

  // 一片带缺刻尖头的樱花瓣（以中心为原点，随 p.rot 旋转）
  function drawPetal(p, alpha, scale){
    var s = p.size * scale;
    ctx.beginPath();
    ctx.moveTo(0, -s * .36);
    ctx.quadraticCurveTo( s * .30, -s * .62,  s * .34, -s * .32);
    ctx.quadraticCurveTo( s * .58,  s * .04,  s * .24,  s * .34);
    ctx.quadraticCurveTo( s * .10,  s * .56,  0,        s * .50);
    ctx.quadraticCurveTo(-s * .10,  s * .56, -s * .24,  s * .34);
    ctx.quadraticCurveTo(-s * .58,  s * .04, -s * .34, -s * .32);
    ctx.quadraticCurveTo(-s * .30, -s * .62,  0,       -s * .36);
    ctx.closePath();
    var c = p.color;
    ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
    ctx.fill();
  }

  function tick(now){
    var dt = Math.min((now - lastT) / 1000, .05);
    lastT = now;

    ctx.clearRect(0, 0, W, H);

    // 点击光环：一圈快速扩散淡出的粉色涟漪
    for (var r = ripples.length - 1; r >= 0; r--){
      var rp = ripples[r];
      rp.life += dt;
      var re = rp.life / rp.ttl;
      if (re >= 1){ ripples.splice(r, 1); continue; }
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 6 + re * 26, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 172, 204, ' + (.4 * (1 - re)).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (var i = petals.length - 1; i >= 0; i--){
      var p = petals[i];
      p.life += dt;

      if (p.life >= p.ttl){ petals.splice(i, 1); continue; }

      // 物理：上抛 → 重力下坠；水平速度快速衰减，叠加左右摇曳
      p.vy += 280 * dt;
      p.vx *= Math.pow(.35, dt);
      p.vy *= Math.pow(.5, dt);
      p.x += p.vx * dt + Math.sin(p.life * p.swayFreq * 6.283 + p.swayPhase) * p.swayAmp * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      // 尾段淡出 + 轻微缩小
      var e = p.life / p.ttl;
      var alpha = p.baseAlpha * (e < .65 ? 1 : 1 - (e - .65) / .35);
      var scale = 1 - .3 * e;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      drawPetal(p, alpha, scale);
      ctx.restore();
    }

    if (petals.length || ripples.length){
      requestAnimationFrame(tick);
    } else {
      running = false;
      ctx.clearRect(0, 0, W, H);
    }
  }

  function handler(e){
    burst(e.clientX, e.clientY);
  }

  // pointerdown 反馈最快；老内核退回 mousedown / touchstart
  if (window.PointerEvent){
    document.addEventListener('pointerdown', handler, { passive: true });
  } else {
    document.addEventListener('mousedown', handler, { passive: true });
    document.addEventListener('touchstart', function(e){
      var t = e.changedTouches && e.changedTouches[0];
      if (t) burst(t.clientX, t.clientY);
    }, { passive: true });
  }
})();
</script>

<!-- ============================================================
     全站搜索（Pagefind 内核 + 毛玻璃面板）
     - 入口：右下角浮动按钮 / 快捷键 Ctrl+K（Mac 为 Cmd+K）
     - 输入即搜、关键词高亮、↑↓ 选择、Enter 打开、Esc 关闭
     - 索引不在 hexo server 里：需先构建再预览
         npm run build    → 生成 public/pagefind（部署用）
         npm run preview  → 构建 + 以 public 目录启动本地预览
     - 未构建时打开面板会提示"索引未生成"，不影响其他功能
============================================================ -->
<button id="search-btn" aria-label="搜索文章（Ctrl+K）" title="搜索文章（Ctrl+K）">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7"></circle>
    <line x1="21" y1="21" x2="16.2" y2="16.2"></line>
  </svg>
</button>

<div id="search-overlay" hidden>
  <div class="search-panel" role="dialog" aria-modal="true" aria-label="站内搜索">
    <div class="search-head">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"></circle>
        <line x1="21" y1="21" x2="16.2" y2="16.2"></line>
      </svg>
      <input id="search-input" type="search" placeholder="搜索文章…" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button type="button" class="search-close" aria-label="关闭搜索（Esc）">&#10005;</button>
    </div>
    <div class="search-body">
      <div id="search-hint">输入关键词，即时搜索全站文章</div>
      <ul id="search-results"></ul>
    </div>
    <div class="search-foot">
      <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> 选择</span>
      <span><kbd>Enter</kbd> 打开</span>
      <span><kbd>Esc</kbd> 关闭</span>
      <span id="search-count"></span>
    </div>
  </div>
</div>

<script>
(function(){
  var overlay = document.getElementById('search-overlay');
  var btn = document.getElementById('search-btn');
  var input = document.getElementById('search-input');
  var resultsEl = document.getElementById('search-results');
  var hintEl = document.getElementById('search-hint');
  var countEl = document.getElementById('search-count');
  var pagefindPromise = null;
  var items = [];          // 当前结果列表（a 元素）
  var activeIdx = -1;      // 键盘选中的下标
  var debounceTimer = null;
  var searchSeq = 0;       // 丢弃过期搜索结果

  // ---------- 打开 / 关闭 ----------
  function open(){
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function(){ input.focus(); }, 60);
  }
  function close(){
    overlay.hidden = true;
    document.body.style.overflow = '';
  }
  btn.addEventListener('click', open);
  overlay.addEventListener('click', function(e){
    if (e.target === overlay) close();
  });
  overlay.querySelector('.search-close').addEventListener('click', close);

  document.addEventListener('keydown', function(e){
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')){
      e.preventDefault();
      if (overlay.hidden){ open(); } else { close(); }
    } else if (e.key === 'Escape' && !overlay.hidden){
      close();
    }
  });

  // ---------- Pagefind 懒加载 ----------
  function loadPagefind(){
    if (!pagefindPromise){
      pagefindPromise = import('/pagefind/pagefind.js');
      pagefindPromise.catch(function(){ pagefindPromise = null; });
    }
    return pagefindPromise;
  }

  // ---------- 渲染 ----------
  function showHint(text){
    hintEl.textContent = text;
    hintEl.style.display = '';
    resultsEl.innerHTML = '';
    items = [];
    activeIdx = -1;
  }
  function hideHint(){ hintEl.style.display = 'none'; }

  function setActive(idx){
    if (activeIdx >= 0 && items[activeIdx]){
      items[activeIdx].classList.remove('active');
    }
    activeIdx = idx;
    if (idx >= 0 && items[idx]){
      items[idx].classList.add('active');
      items[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  function render(list, total){
    hideHint();
    countEl.textContent = total > 0 ? (list.length + ' / ' + total + ' 条结果') : '';
    resultsEl.innerHTML = '';
    items = [];
    activeIdx = -1;
    if (!list.length){
      showHint('没有找到相关文章，换个关键词试试？');
      return;
    }
    var frag = document.createDocumentFragment();
    list.forEach(function(d){
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = d.url;
      // 文章页标题形如「文章名 | 站点名」，只取第一段展示
      var title = (d.meta && d.meta.title ? d.meta.title : '').split(' | ')[0];
      var t = document.createElement('div');
      t.className = 'sr-title';
      t.textContent = title;
      var ex = document.createElement('div');
      ex.className = 'sr-excerpt';
      // excerpt 由 pagefind 生成，已转义正文并带 <mark> 高亮
      ex.innerHTML = d.excerpt || '';
      a.appendChild(t);
      a.appendChild(ex);
      li.appendChild(a);
      frag.appendChild(li);
      items.push(a);
      a.addEventListener('mouseenter', function(){
        setActive(items.indexOf(a));
      });
    });
    resultsEl.appendChild(frag);
  }

  // ---------- 搜索 ----------
  function doSearch(){
    var q = input.value.trim();
    var seq = ++searchSeq;
    if (!q){
      countEl.textContent = '';
      showHint('输入关键词，即时搜索全站文章');
      return;
    }
    showHint('搜索中…');
    loadPagefind().then(function(pf){
      return pf.search(q);
    }).then(function(res){
      if (seq !== searchSeq) return;   // 输入已变化，丢弃过期结果
      var total = res.results.length;
      var top = res.results.slice(0, 8);
      return Promise.all(top.map(function(r){ return r.data(); })).then(function(datas){
        if (seq !== searchSeq) return;
        render(datas, total);
      });
    }).catch(function(){
      if (seq !== searchSeq) return;
      showHint('搜索索引尚未生成：先运行 npm run build 构建索引，再打开预览');
      countEl.textContent = '';
    });
  }

  input.addEventListener('input', function(){
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSearch, 120);
  });

  input.addEventListener('keydown', function(e){
    if (e.key === 'ArrowDown'){
      e.preventDefault();
      if (items.length) setActive((activeIdx + 1) % items.length);
    } else if (e.key === 'ArrowUp'){
      e.preventDefault();
      if (items.length) setActive((activeIdx - 1 + items.length) % items.length);
    } else if (e.key === 'Enter'){
      if (activeIdx < 0 && items.length) setActive(0);
      if (items[activeIdx]) location.href = items[activeIdx].getAttribute('href');
    }
  });
})();
</script>
