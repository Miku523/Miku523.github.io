/**
 * Live2D 看板娘：博丽灵梦（东方 Cannon Ball 模型，Cubism 3）
 * ------------------------------------------------------------
 * - 模型与运行时全部自托管（/live2d/reimu/ 与 /js/vendor/），不依赖外链 CDN
 * - 固定在页面左侧，画布 pointer-events:none，完全不挡页面点击
 * - 交互：点击模型本体随机播一个动作（document 级监听 + hitTest）
 * - 动作组：模型没有命名动作组，idle/tap 都映射到默认组（38 个动作随机）
 * - 停用条件：移动端（<900px）、系统"减少动态效果"、运行时加载失败
 * - 资源参考 https://github.com/guansss/pixi-live2d-display
 */
(function () {
  'use strict';

  // ---------- 环境守卫：移动端 / 减少动效 / 运行时未就绪 ----------
  if (window.innerWidth < 900) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.PIXI || !window.PIXI.live2d || !window.PIXI.live2d.Live2DModel) return;

  var MODEL_URL = '/live2d/reimu/object_live2d_001_101.asset.model3.json';
  var CW_MAX = 280;                          // 画布最大宽（模型贴合宽度不会超过它）
  var CH = Math.min(380, Math.round(window.innerHeight * 0.42)); // 画布高
  var SCALE = 0.93;                          // 整体缩放系数（比之前略小，少挡正文）

  // ---------- 画布：贴死左边缘，透明背景，不挡点击 ----------
  var canvas = document.createElement('canvas');
  canvas.className = 'reimu-live2d';
  canvas.setAttribute('aria-hidden', 'true');
  // 样式内联写死（同 click-sakura 的做法）：不依赖 main.css 缓存新旧
  // 宽度先给最大值，模型加载后按人物实际宽度收紧，让左侧不留空白
  canvas.style.cssText = 'position:fixed;left:0;bottom:0;width:' + CW_MAX + 'px;height:' + CH + 'px;'
    + 'z-index:1200;pointer-events:none;opacity:0;transition:opacity .8s ease;will-change:transform;';
  document.body.appendChild(canvas);

  var app = new PIXI.Application({
    view: canvas,
    width: CW_MAX,
    height: CH,
    backgroundAlpha: 0,
    autoDensity: true,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2)
  });

  // ---------- 加载模型 ----------
  // 灵梦模型加载失败时静默收场：移除画布，不影响博客其余功能
  PIXI.live2d.Live2DModel.from(MODEL_URL, { autoInteract: false })
    .then(function (model) {
      app.stage.addChild(model);

      // 动作组映射：该模型动作全部在未命名组 "" 里
      var mm = model.internalModel.motionManager;
      mm.groups.idle = '';
      mm.groups.tap = '';

      // 等比缩放到底部对齐，再按人物实际宽度收紧画布 → 人物贴住屏幕左边缘
      var scale = Math.min(CW_MAX / model.width, CH / model.height) * SCALE;
      var mw = Math.max(60, Math.ceil(model.width * scale));
      app.renderer.resize(mw, CH);
      canvas.style.width = mw + 'px';

      model.scale.set(scale);
      model.anchor.set(0.5, 1);            // 底边中点为锚点
      model.position.set(mw / 2, CH + 2);

      canvas.style.opacity = '1';          // 就绪后淡入

      // 对外暴露一点能力：聊天面板通过 window 事件与这里联动
      window.__REIMU__ = {
        model: model,
        playMotion: function () { try { model.motion(''); } catch (err) { /* 无动作时忽略 */ } }
      };

      // ---------- 点击互动：命中模型本体才触发 ----------
      function hitTest(clientX, clientY) {
        var rect = canvas.getBoundingClientRect();
        var lx = clientX - rect.left, ly = clientY - rect.top;
        if (lx < 0 || ly < 0 || lx > rect.width || ly > rect.height) return false;
        var local = model.toLocal(new PIXI.Point(lx, ly));
        return model.hitTest(local.x, local.y);
      }

      document.addEventListener('click', function (e) {
        if (hitTest(e.clientX, e.clientY)) {
          model.motion('');
          // 通知聊天面板：被点到了（面板会自己打开；没有面板时只是播个动作）
          window.dispatchEvent(new CustomEvent('reimu:tap'));
        }
      }, { passive: true });

      // 悬停到模型上时显示手型（节流：每 80ms 最多测一次）
      var lastMove = 0;
      document.addEventListener('pointermove', function (e) {
        var now = Date.now();
        if (now - lastMove < 80) return;
        lastMove = now;
        var rect = canvas.getBoundingClientRect();
        var inside = e.clientX >= rect.left && e.clientX <= rect.right
          && e.clientY >= rect.top && e.clientY <= rect.bottom;
        document.body.style.cursor = (inside && hitTest(e.clientX, e.clientY)) ? 'pointer' : '';
      }, { passive: true });
    })
    .catch(function (err) {
      // 加载失败：清掉空画布，当无事发生
      console.warn('[reimu-live2d] 模型加载失败，看板娘未启用：', err);
      canvas.remove();
      app.destroy(false);
    });
})();
