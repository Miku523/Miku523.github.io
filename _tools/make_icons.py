# -*- coding: utf-8 -*-
"""
博客图标一键生成工具（NexT 主题）

用法：
    python make_icons.py <源图片路径> [输出目录]
    例：python make_icons.py "D:/hexo_blog/source/images/点.png"

产出（默认写入 D:/hexo_blog/source/images/）：
    favicon.ico                  多尺寸 ICO（16/32/48），浏览器标签页
    favicon-16x16-next.png       16x16 PNG
    favicon-32x32-next.png       32x32 PNG
    apple-touch-icon-next.png    180x180，iOS/微信 添加到主屏用
    android-chrome-192x192.png   安卓主屏图标
    android-chrome-512x512.png   安卓启动图/PWA 图标
    manifest.json                PWA 清单
    browserconfig.xml            旧版 IE/Edge 磁贴

说明：
- 原图会按“居中裁成正方形 + LANCZOS 高质量缩放”处理；
- 若原图是照片且边缘被裁掉重要内容，先自己裁好正方形再喂进来；
- 生成的 manifest.json / browserconfig.xml 里的站点名可自行改。
"""

import os
import sys
import json

try:
    from PIL import Image
except ImportError:
    sys.exit("缺少 Pillow，请先安装：pip install pillow")

DEFAULT_OUT = r"D:\hexo_blog\source\images"
SITE_NAME = "Ascend Log"
THEME_COLOR = "#ffffff"
BG_COLOR = "#ffffff"   # 生成 ICO 时兜底背景色（透明图会被保留透明）


def square_crop(im):
    """居中裁成正方形（保持原比例，不拉伸）"""
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return im.crop((left, top, left + side, top + side))


def resize(im, size):
    return im.resize((size, size), Image.LANCZOS)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    src = os.path.abspath(sys.argv[1])
    out = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT

    if not os.path.isfile(src):
        sys.exit("源图片不存在：%s" % src)
    os.makedirs(out, exist_ok=True)

    im = Image.open(src)
    # 统一转成 RGBA（保留透明；照片就是全不透明）
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    im = square_crop(im)

    written = []

    def save(name, size):
        p = os.path.join(out, name)
        resize(im, size).save(p, "PNG", optimize=True)
        written.append(p)

    # 浏览器标签页图标
    save("favicon-16x16-next.png", 16)
    save("favicon-32x32-next.png", 32)
    save("apple-touch-icon-next.png", 180)

    # 安卓 / PWA
    save("android-chrome-192x192.png", 192)
    save("android-chrome-512x512.png", 512)

    # 多尺寸 ICO：PIL 支持一次写入多张尺寸
    ico_path = os.path.join(out, "favicon.ico")
    resize(im, 64).save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )
    written.append(ico_path)

    # PWA 清单
    manifest = {
        "name": SITE_NAME,
        "short_name": SITE_NAME,
        "icons": [
            {"src": "/images/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/images/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png"},
        ],
        "theme_color": THEME_COLOR,
        "background_color": BG_COLOR,
        "display": "standalone",
    }
    mpath = os.path.join(out, "manifest.json")
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    written.append(mpath)

    # 旧版 Edge/IE 磁贴
    bpath = os.path.join(out, "browserconfig.xml")
    with open(bpath, "w", encoding="utf-8") as f:
        f.write(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<browserconfig>\n'
            '  <msapplication>\n'
            '    <tile>\n'
            '      <square150x150logo src="/images/android-chrome-192x192.png"/>\n'
            '      <TileColor>%s</TileColor>\n'
            '    </tile>\n'
            '  </msapplication>\n'
            '</browserconfig>\n' % THEME_COLOR
        )
    written.append(bpath)

    print("源图：%s  %dx%d" % (src, *Image.open(src).size))
    print("已生成 %d 个文件到 %s：" % (len(written), out))
    for p in written:
        print("  %-34s %8.1f KB" % (os.path.basename(p), os.path.getsize(p) / 1024))


if __name__ == "__main__":
    main()
