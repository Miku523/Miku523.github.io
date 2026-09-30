/**
 * 音乐播放列表生成器（右侧悬浮播放器的数据源）
 * ------------------------------------------------------------
 * 作用：构建时扫描 source/music/ 目录，把音频文件整理成 /music/playlist.json，
 *      前端播放器（source/js/music-player.js）读取它来生成歌单。
 *
 * 用法：把音频文件丢进 source/music/ 即可，无需改任何配置：
 *   source/music/
 *     Ascend Log - 起风了.mp3        → 歌手 "Ascend Log"，歌名 "起风了"
 *     01 某歌手 - 某歌名.mp3         → 前缀序号用于排序，标题里自动去掉
 *     纯歌名.mp3                     → 只显示歌名
 *     Ascend Log - 起风了.jpg       → 同名图片自动当封面
 *     covers/起风了.jpg              → 或放进 covers/ 子目录（按歌名匹配）
 *     cover.jpg                      → 目录级默认封面，所有歌共用
 *
 * 手动干预排序/元数据：在 source/_data/music.yml 里写 tracks 列表（可选）
 *   enable: true            # 总开关，false 时右侧播放器完全不注入
 *   tracks:
 *     - file: Ascend Log - 起风了.mp3
 *       title: 起风了
 *       artist: 买辣椒也用券
 *       cover: /images/covers/qifengle.jpg
 *
 * 注意：新增/删除音频后需要重新构建（npm run build）才会更新歌单。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wav', '.flac', '.mp4'];
const COVER_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];

// ---------- 元数据（歌手 - 歌名）解析 ----------
function parseName(name) {
  // 去掉开头的排序序号： "01." / "01 " / "01-" 等
  let base = name.replace(/^\s*\d{1,3}\s*[.\-_、)]*\s+/, '').trim() || name;
  let artist = '';
  let title = base;

  // 支持 " - " / " – " / " — " 作为分隔（要求两侧有空格，避免误切英文歌名里的连字符）
  const m = base.match(/^(.*?)\s+[-–—]\s+(.*)$/);
  if (m) {
    artist = m[1].trim();
    title = m[2].trim();
  }
  return { artist, title };
}

function naturalCompare(a, b) {
  try {
    return a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
  } catch (e) {
    return a < b ? -1 : a > b ? 1 : 0;
  }
}

// ---------- 目录扫描 ----------
function scanDir(dir, dirCovers) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // covers / lyrics 之类的子目录不递归找音频，只登记为封面来源
      if (/^(covers?|cover|封面|图片)$/i.test(ent.name)) {
        dirCovers.push(...listImages(full));
      } else {
        out.push(...scanDir(full, dirCovers));
      }
      continue;
    }
    const ext = path.extname(ent.name).toLowerCase();
    if (AUDIO_EXT.indexOf(ext) === -1) continue;

    const rel = path.relative(dir, full).split(path.sep).join('/'); // 相对 source/music 的路径
    const { artist, title } = parseName(path.basename(ent.name, ext));
    out.push({
      _file: rel,
      _base: path.basename(ent.name, ext),
      _dir: path.dirname(full),
      _order: orderOf(ent.name),
      title: title,
      artist: artist
    });
  }
  return out;
}

function orderOf(name) {
  const m = name.match(/^\s*(\d{1,3})/);
  return m ? parseInt(m[1], 10) : null;
}

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && COVER_EXT.indexOf(path.extname(e.name).toLowerCase()) !== -1)
    .map((e) => path.join(dir, e.name));
}

// 找封面：同名图 → covers/<歌名>.图 → 目录默认 cover.图
function findCover(track, pool) {
  for (const ext of COVER_EXT) {
    const same = path.join(track._dir, track._base + ext);
    if (fs.existsSync(same)) return same;
  }
  for (const img of pool) {
    const b = path.basename(img, path.extname(img));
    if (b === track._base) return img;                                    // 文件名完全一致
    if (b.toLowerCase() === 'cover' || b === '封面') return img;           // 目录默认封面
    const parsed = parseName(b);
    if (parsed.title && parsed.title === track.title) return img;          // 按歌名匹配
  }
  return null;
}

function toUrl(abs) {
  const rel = path.relative(hexo.source_dir, abs).split(path.sep).join('/');
  const root = (hexo.config.root || '/').replace(/\/?$/, '/');
  return root + rel;
}

// ---------- 读取可选的手动清单 ----------
function readManual() {
  const ymlPath = path.join(hexo.source_dir, '_data', 'music.yml');
  if (!fs.existsSync(ymlPath)) return { enable: true, tracks: null };
  try {
    const data = hexo.render.renderSync({ path: ymlPath, engine: 'yaml' }) || {};
    return {
      enable: data.enable !== false,
      tracks: Array.isArray(data.tracks) ? data.tracks : null
    };
  } catch (e) {
    hexo.log.warn('[music] 解析 source/_data/music.yml 失败：' + e.message);
    return { enable: true, tracks: null };
  }
}

hexo.extend.generator.register('music_playlist', function () {
  const musicDir = path.join(hexo.source_dir, 'music');
  const rootCovers = [];
  const scanned = scanDir(musicDir, rootCovers);
  const manual = readManual();

  // 手动清单：以 yml 里的顺序为准，只保留真实存在的文件
  let tracks = [];
  if (manual.tracks) {
    const byFile = {};
    scanned.forEach((t) => { byFile[t._file] = t; });
    manual.tracks.forEach((raw, i) => {
      if (!raw || !raw.file) return;
      const key = String(raw.file).replace(/\\/g, '/');
      const found = byFile[key];
      if (!found) {
        hexo.log.warn('[music] music.yml 里的 "' + key + '" 在 source/music/ 中不存在，已跳过');
        return;
      }
      tracks.push({
        item: found,
        order: i,
        title: raw.title || found.title,
        artist: raw.artist || found.artist,
        cover: raw.cover || null
      });
    });
  } else {
    scanned
      .sort((a, b) => {
        const ao = a._order === null ? Number.MAX_SAFE_INTEGER : a._order;
        const bo = b._order === null ? Number.MAX_SAFE_INTEGER : b._order;
        if (ao !== bo) return ao - bo;
        return naturalCompare(a._file, b._file);
      })
      .forEach((t, i) => {
        tracks.push({ item: t, order: i, title: t.title, artist: t.artist, cover: null });
      });
  }

  const output = {
    generated: new Date().toISOString(),
    count: tracks.length,
    tracks: tracks.map((t, i) => {
      let coverUrl = '';
      if (t.cover) {
        // 手动指定：支持外链、站内路径（/images/xxx.jpg）、相对 source 的路径
        if (/^https?:\/\//i.test(t.cover) || /^\/\//.test(t.cover)) {
          coverUrl = t.cover;
        } else {
          const abs = path.isAbsolute(t.cover)
            ? t.cover
            : path.join(hexo.source_dir, t.cover.replace(/^\//, ''));
          coverUrl = fs.existsSync(abs) ? toUrl(abs) : '';
        }
      } else {
        const abs = findCover(t.item, rootCovers);
        coverUrl = abs ? toUrl(abs) : '';
      }
      return {
        id: i,
        title: t.title || t.item._base,
        artist: t.artist || '',
        src: toUrl(path.join(musicDir, t.item._file)),
        cover: coverUrl
      };
    })
  };

  return {
    path: 'music/playlist.json',
    data: JSON.stringify(output, null, 2)
  };
});
