#!/bin/bash
# ============================================================
# Hexo 博客服务器端一键部署脚本
# 适用：Ubuntu 22.04 / 24.04（腾讯云轻量应用服务器）
# 用法：bash deploy_blog.sh
# ============================================================
set -e

BLOG_DIR="/var/www/blog"
REPO="ssh://git@ssh.github.com:443/Miku523/Miku523.github.io.git"
BRANCH="backup"
DOMAIN="mikuascendlog.com"

echo "=== [1/7] 更新系统包索引 ==="
sudo apt-get update -y

echo "=== [2/7] 安装基础依赖（git / nginx / curl） ==="
sudo apt-get install -y git nginx curl ca-certificates

echo "=== [3/7] 安装 Node.js 20 LTS ==="
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v && npm -v

echo "=== [4/7] 配置 git 走 SSH 443（避开 GitHub 23 端口封锁） ==="
mkdir -p ~/.ssh && chmod 700 ~/.ssh
if ! grep -q "Host ssh.github.com" ~/.ssh/config 2>/dev/null; then
  cat >> ~/.ssh/config <<'SSHCFG'
Host ssh.github.com
  HostName ssh.github.com
  Port 443
  User git
SSHCFG
  chmod 600 ~/.ssh/config
fi

echo "=== [5/7] 克隆博客源码 ==="
sudo mkdir -p /var/www
sudo chown -R "$USER":"$USER" /var/www
if [ ! -d "$BLOG_DIR/.git" ]; then
  git clone -b "$BRANCH" "$REPO" "$BLOG_DIR"
else
  echo "目录已存在，跳过克隆"
fi

echo "=== [6/7] 安装依赖并构建 ==="
cd "$BLOG_DIR"
npm install --registry=https://registry.npmmirror.com
npm run build

echo "=== [7/7] 配置 nginx ==="
sudo tee /etc/nginx/sites-available/blog >/dev/null <<NGINXCFG
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    root /var/www/blog/public;
    index index.html;

    # 支持 blog/xxx/ 形式的干净链接
    location / {
        try_files \$uri \$uri/ \$uri.html =404;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|webp|avif)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # pagefind 搜索索引
    location /pagefind/ {
        expires 7d;
        add_header Cache-Control "public";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # 自定义 404
    error_page 404 /404.html;
}
NGINXCFG

sudo ln -sf /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/blog
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "============================================"
echo " 部署完成！"
echo " 博客目录: $BLOG_DIR/public"
echo " 访问方式: http://<服务器公网IP>/"
echo " 绑定域名后: http://${DOMAIN}/"
echo "============================================"
