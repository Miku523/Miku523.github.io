/**
 * 右侧悬浮音乐播放器 —— 页面注入
 * ------------------------------------------------------------
 * 为什么用 filter 注入而不是写进 source/_data/body-end.swig：
 *   播放器是自成一体的小功能，独立成文件后好维护、好整块删除，
 *   也不会和 body-end.swig 里其它脚本互相干扰。
 *
 * 构建时做两件事：
 *   1. 把 source/_data/music-player.css 的内容内联成 <style>（不额外发请求）
 *   2. 在 </body> 前插入播放器骨架 + <script defer src="/js/music-player.js">
 *
 * 歌单数据由 scripts/music-playlist.js 生成到 /music/playlist.json
 * 总开关：source/_data/music.yml 里写 enable: false
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TAG_ID = 'id="music-player"';

function isEnabled() {
  const yml = path.join(hexo.source_dir, '_data', 'music.yml');
  if (!fs.existsSync(yml)) return true;
  try {
    const data = hexo.render.renderSync({ path: yml, engine: 'yaml' }) || {};
    return data.enable !== false;
  } catch (e) {
    return true;
  }
}

function readCss() {
  const file = path.join(hexo.source_dir, '_data', 'music-player.css');
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

// 站点可能部署在子目录里，用 config.root 拼出正确的资源地址
function rootUrl(p) {
  const root = (hexo.config.root || '/').replace(/\/?$/, '/');
  return root + String(p).replace(/^\//, '');
}

const ICON = {
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l10-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="16" cy="16" r="3"></circle></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"></path></svg>',
  play: '<svg class="mp-i-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"></path></svg>'
      + '<svg class="mp-i-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4.2" height="15" rx="1.2"></rect><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"></rect></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h2.2v14H7z"></path><path d="M19 5.8v12.4L9.4 12z"></path></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.8 5H17v14h-2.2z"></path><path d="M5 5.8v12.4L14.6 12z"></path></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h11M4 12h11M4 17h7"></path><path d="M18 11v7"></path><circle cx="18.5" cy="18.5" r="2.2" fill="currentColor" stroke="none"></circle></svg>',
  modeList: '<svg class="mp-i-list" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l3 3-3 3"></path><path d="M20 6H8a5 5 0 0 0-5 5"></path><path d="M7 21l-3-3 3-3"></path><path d="M4 18h12a5 5 0 0 0 5-5"></path></svg>',
  modeSingle: '<svg class="mp-i-single" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l3 3-3 3"></path><path d="M20 6H8a5 5 0 0 0-5 5"></path><path d="M7 21l-3-3 3-3"></path><path d="M4 18h12a5 5 0 0 0 5-5"></path><path d="M11.4 9.6l1.3-.7V15" stroke-width="2"></path></svg>',
  modeShuffle: '<svg class="mp-i-shuffle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h3.2c1.6 0 2.6.8 3.6 2l4.4 7c1 1.6 2 2.4 3.6 2.4H21"></path><path d="M18 3.5L21 6l-3 2.5"></path><path d="M3 18h3.2c1.6 0 2.6-.8 3.6-2"></path><path d="M14.6 8.2c1-1.4 2-2.2 3.6-2.2H21"></path><path d="M18 15.5L21 18l-3 2.5"></path></svg>',
  volHigh: '<svg class="mp-i-vol-high" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6.5 9H3v6h3.5L11 19z" fill="currentColor"></path><path d="M15.6 8.4a5 5 0 0 1 0 7.2"></path><path d="M18.4 5.6a9 9 0 0 1 0 12.8"></path></svg>',
  volLow: '<svg class="mp-i-vol-low" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6.5 9H3v6h3.5L11 19z" fill="currentColor"></path><path d="M15.6 8.4a5 5 0 0 1 0 7.2"></path></svg>',
  volMute: '<svg class="mp-i-vol-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6.5 9H3v6h3.5L11 19z" fill="currentColor"></path><path d="M16 9.5l5 5M21 9.5l-5 5"></path></svg>'
};

function buildMarkup() {
  return `
<!-- ============================================================
     右侧悬浮音乐播放器
     - 样式：source/_data/music-player.css（构建时内联）
     - 逻辑：/js/music-player.js
     - 歌单：/music/playlist.json（把音频放进 source/music/ 后重新构建）
     - 关闭：source/_data/music.yml 里 enable: false
     骨架与逻辑分离：DOM 只负责结构，状态全挂在 data-* 属性上，
     JS 靠属性选择器切换图标，避免 innerHTML 反复重建导致闪烁
============================================================ -->
<div id="music-player" data-state="collapsed" data-list="closed" data-playing="0" data-mode="list" data-vol="high" data-pagefind-ignore data-playlist="${rootUrl('music/playlist.json')}">
  <button class="mp-toggle" type="button" aria-label="打开音乐播放器" title="音乐播放器" aria-expanded="false">${ICON.note}</button>
  <section class="mp-panel" role="region" aria-label="音乐播放器">
    <div class="mp-head">
      <span class="mp-head-label">音乐播放器</span>
      <button class="mp-min" type="button" aria-label="收起播放器" title="收起">${ICON.minus}</button>
    </div>
    <div class="mp-now">
      <div class="mp-disc"><img class="mp-cover" alt="" width="78" height="78"></div>
      <div class="mp-meta">
        <div class="mp-song">加载歌单…</div>
        <div class="mp-artist"></div>
      </div>
    </div>
    <div class="mp-progress">
      <span class="mp-time mp-time-cur">0:00</span>
      <div class="mp-bar" data-role="seek" role="slider" tabindex="0" aria-label="播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="0:00">
        <div class="mp-bar-track"><div class="mp-bar-buffer"></div><div class="mp-bar-fill"></div><div class="mp-bar-knob"></div></div>
      </div>
      <span class="mp-time mp-time-dur">0:00</span>
    </div>
    <div class="mp-controls">
      <button class="mp-btn" type="button" data-act="mode" aria-label="播放模式" title="列表循环">${ICON.modeList}${ICON.modeSingle}${ICON.modeShuffle}</button>
      <button class="mp-btn" type="button" data-act="prev" aria-label="上一首" title="上一首">${ICON.prev}</button>
      <button class="mp-btn mp-play" type="button" data-act="play" aria-label="播放" title="播放/暂停">${ICON.play}</button>
      <button class="mp-btn" type="button" data-act="next" aria-label="下一首" title="下一首">${ICON.next}</button>
      <button class="mp-btn" type="button" data-act="list" aria-label="播放列表" title="播放列表" aria-expanded="false">${ICON.list}</button>
    </div>
    <div class="mp-volume">
      <button class="mp-vol-icon" type="button" data-act="mute" aria-label="静音" title="静音/取消静音">${ICON.volHigh}${ICON.volLow}${ICON.volMute}</button>
      <div class="mp-bar" data-role="volume" role="slider" tabindex="0" aria-label="音量" aria-valuemin="0" aria-valuemax="100" aria-valuenow="70">
        <div class="mp-bar-track"><div class="mp-bar-fill"></div><div class="mp-bar-knob"></div></div>
      </div>
      <span class="mp-vol-num">70</span>
    </div>
    <ul class="mp-list"></ul>
  </section>
  <!-- 2026-09-30：preload 改 none。metadata 模式下赋值 src 也会拉一大段音频，
       实测把 window load 拖慢 6 秒（pace 进度条干转）。none 时按下播放才拉流。 -->
  <audio class="mp-audio" preload="none"></audio>
</div>
`;
}

hexo.extend.filter.register('after_render:html', function (str) {
  if (!isEnabled()) return str;
  if (!str || str.indexOf(TAG_ID) !== -1) return str;   // 幂等：已注入过就跳过

  const css = readCss();
  const block = '\n<style id="music-player-style">\n' + css + '\n</style>\n'
    + buildMarkup()
    + '<script defer src="' + rootUrl('js/music-player.js') + '"></script>\n';

  if (/<\/body>/i.test(str)) return str.replace(/<\/body>/i, block + '</body>');
  return str + block;                                   // 极少见：模板没有 </body>
});
