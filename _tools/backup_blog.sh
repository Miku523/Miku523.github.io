#!/bin/bash
# ============================================================
# Hexo 博客源码自动备份
# 目标: Miku523.github.io 仓库的 backup 分支（SSH over 443）
# 内容: md 笔记/图片/配置/scripts/local_patches/主题配置快照
# 调用: 手动 bash 执行 / _tools/backup_blog.bat / Windows 计划任务
# ============================================================
set -u
BLOG_DIR="/d/hexo_blog"
LOCK="$BLOG_DIR/_tools/.backup.lock"

log() { echo "[$(date '+%F %T')] [backup] $*"; }

# 防并发: 上一轮还在跑就跳过
if [ -e "$LOCK" ]; then
  log "another backup is running, skip"
  exit 0
fi
trap 'rm -f "$LOCK"' EXIT
touch "$LOCK"

cd "$BLOG_DIR" || { log "ERROR: cannot enter $BLOG_DIR"; exit 1; }

# 计划任务/无人值守场景: SSH 不允许交互提示, 连不上快速失败
# 专用 known_hosts: ~/.ssh/known_hosts 被写保护, 每次推送会留垃圾临时文件
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=15 -o UserKnownHostsFile=$BLOG_DIR/_tools/known_hosts_backup"

# 1) 同步主题配置快照(主题目录本身被 .gitignore 排除, 见 themes/)
mkdir -p _theme_backup
for t in next butterfly; do
  if [ -f "themes/$t/_config.yml" ]; then
    cp "themes/$t/_config.yml" "_theme_backup/$t._config.yml"
  fi
done

# 2) 提交变更(无变更时静默退出)
git add -A
if git diff --cached --quiet; then
  log "nothing to commit, working tree clean"
  exit 0
fi
git commit -m "backup: $(date '+%F %T')" >/dev/null || { log "ERROR: commit failed"; exit 1; }
log "committed"

# 3) 推送(最多重试 3 次, 间隔 8s)
for i in 1 2 3; do
  if git push backup backup:backup; then
    log "pushed to Miku523.github.io:backup OK"
    exit 0
  fi
  log "push failed (attempt $i/3)"
  [ "$i" -lt 3 ] && sleep 8
done

log "ERROR: push failed after 3 attempts, will retry on next run"
exit 1
