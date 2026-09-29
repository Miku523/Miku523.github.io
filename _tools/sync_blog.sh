#!/bin/bash
# ============================================================
# 博客自动同步脚本
# 作用：拉取 GitHub backup 分支最新代码 → 重新构建 → 刷新页面
# 用法：bash _tools/sync_blog.sh
# 建议：加到 crontab 每 5 分钟执行一次，实现"push 后自动上线"
#   crontab -e
#   */5 * * * * /bin/bash /var/www/blog/_tools/sync_blog.sh >> /var/log/blog-sync.log 2>&1
# ============================================================
set -e

BLOG_DIR="/var/www/blog"
cd "$BLOG_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始同步..."

# 拉取最新代码
git fetch origin backup
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/backup)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "已是最新版本，无需构建"
  exit 0
fi

git pull origin backup

# 依赖有变化时重装
if git diff --name-only "$LOCAL" "$REMOTE" | grep -q "package.json"; then
  echo "检测到依赖变化，重新安装..."
  npm install --registry=https://registry.npmmirror.com
fi

# 重新构建
npm run build

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 同步完成：$LOCAL -> $REMOTE"
