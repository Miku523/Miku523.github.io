# 右侧音乐播放器 —— 使用说明

> 部署于 2026-09-29。左侧看板娘（灵梦 Live2D）已由另一个会话接入，本播放器负责右侧。

## 一、它由哪些文件组成

| 文件 | 作用 | 能否删 |
| --- | --- | --- |
| `scripts/music-playlist.js` | 构建时扫描 `source/music/`，生成 `/music/playlist.json` | 删了就只剩空播放器 |
| `scripts/music-player-inject.js` | 在 `</body>` 前注入播放器骨架 + 内联样式 + 脚本引用 | 删了播放器整体消失 |
| `source/_data/music-player.css` | 播放器全部样式（构建时被内联进页面） | 同上 |
| `source/js/music-player.js` | 播放器运行逻辑（原生 `<audio>`，无第三方库） | 同上 |
| `source/music/` | 放音频文件的地方 | 歌曲都放这里 |

之所以单独成文件、不写进 `source/_data/body-end.swig`：这个功能自成一体，
好维护也好整块摘除，而且不会和 `body-end.swig` 里现有的背景/搜索/看板娘脚本互相干扰。

## 二、怎么加歌（最常用）

把音频文件直接丢进 `source/music/`，然后重新构建：

```bash
npm run build        # 生成 + Pagefind 索引（部署前用这个）
npm run preview      # 生成 + 本地预览
npm run deploy       # 生成 + 推到 GitHub Pages
```

### 文件命名规则

| 文件名 | 解析结果 |
| --- | --- |
| `周杰伦 - 晴天.mp3` | 歌手「周杰伦」，歌名「晴天」 |
| `01 周杰伦 - 晴天.mp3` | 前缀序号只用于排序，不显示 |
| `晴天.mp3` | 只有歌名，歌手显示「未知歌手」 |
| `周杰伦-晴天.mp3` | 不加空格的连字符**不会**被切开，整体当歌名 |

排序：先按文件名开头的数字（`01`、`02`…），没有数字的按文件名自然排序排在后面。

### 封面

按优先级自动查找：

1. 同名图片：`source/music/周杰伦 - 晴天.jpg`
2. `source/music/covers/晴天.jpg`（按歌名匹配）
3. `source/music/cover.jpg`（目录默认封面，所有歌共用）

都找不到就用内置的粉蓝渐变＋音符占位图。图片扩展名支持 jpg/jpeg/png/webp/avif/gif。

### 手动指定顺序与元数据（可选）

新建 `source/_data/music.yml`：

```yaml
enable: true                     # 总开关，改成 false 则整个播放器不注入

# 写了 tracks 就以它为准（顺序、标题、封面都能改），只保留真实存在的文件
tracks:
  - file: 周杰伦 - 晴天.mp3
    title: 晴天
    artist: 周杰伦
    cover: /images/covers/qingtian.jpg
```

`enable: false` 是紧急开关：万一播放器出问题，加这一行重新构建即可让它彻底消失。

## 三、交互说明

- **右下角圆形按钮**：展开/收起播放面板（和昼夜按钮、搜索按钮排成一列，间距 56px）
- **▶**：播放/暂停；**⏮ ⏭**：上一首/下一首（播出 3 秒以上时，上一首先回到本曲开头）
- **模式键**：列表循环 → 单曲循环 → 随机播放
- **进度条/音量条**：可点击、可拖动，键盘 ←/→ 微调（按住 Shift 步长更大）
- **列表键**：展开歌单，点击即切歌
- 播放中圆按钮会有一圈呼吸光晕；唱片封面会转
- 状态持久化：音量、播放模式、上次听的歌与进度、是否展开歌单都存在 localStorage
- 点击面板以外区域自动收起面板（音乐继续播）
- 系统媒体键 / 手机锁屏能显示当前歌曲（Media Session API）
- 某首歌文件坏掉或格式不支持时，自动跳到下一首并提示

## 四、几个必须知道的坑

1. **改过 `source/_data/music-player.css` 后必须清缓存再构建**
   样式是在构建时内联进每个页面的，Hexo 会把渲染结果缓存在 `db.json`，
   不清缓存页面不会重新渲染（和改 `styles.styl` 是同一个坑）：

   ```bash
   rm -f db.json && npm run build     # 或者 npm run clean 再 build
   ```

2. **加歌/删歌不需要清缓存**，重新 `npm run build` 就行——
   歌单是 generator，每次构建都会重新扫描生成。

3. **重新构建后要重启 `hexo server`**
   `scripts/*.js` 是启动时加载的插件，已经在跑的服务不会认识新插件。
   （2026-09-29 另一个会话在 4000 端口起的服务就跑在我加插件之前。）

4. **`source/music/` 里的音频会被完整发布到站点**
   GitHub Pages 有 1GB 仓库 / 100GB 月流量限制，别放太多无损大文件。
   建议单曲控制在 5MB 以内，或用 128kbps 的 mp3。

5. **自动播放会被浏览器拦**
   首次进站不会自动出声（浏览器策略），点一下 ▶ 即可。
   这是刻意设计的，不做弹窗骚扰。

## 五、示例曲目

`source/music/00 Ascend Log - 示例曲目（可删除）.wav` 是我用 Python 合成的一段
10 秒 C 大调小曲，只用来验证播放器能真正出声（实测 Chromium 已在解码音频）。
**放上自己的歌之后直接删掉它即可。**

## 六、搜索索引

播放器根元素带 `data-pagefind-ignore`，歌名/提示文案不会进 Pagefind 搜索索引。

## 七、发现的一个小问题（属于看板娘那边，未改动）

NexT 的「回到顶部」按钮因为侧边栏在右侧，被镜像到了**左下角**
（`.back-to-top { left: 30px; bottom: 30px; z-index: 1300 }`），
而看板娘画布是 `left: 10px; bottom: 0; z-index: 1200`（宽 280 高 ≤380）。
两者重叠：页面往下滚后，回到顶部按钮会画在灵梦身上。
看板娘画布是 `pointer-events: none`，所以按钮仍然可点，只是视觉上压住了人物。
要改的话，把 `source/js/reimu-live2d.js` 里画布的 `z-index:1200` 提到 1400 以上即可
（或把 `.back-to-top` 挪走）。这块归另一个会话的文件，我没有擅自修改。
