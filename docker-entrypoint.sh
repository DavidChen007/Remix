#!/bin/sh
set -e

# 替换 config.js 中的占位符为实际的环境变量
CONFIG_FILE="/usr/share/nginx/html/config.js"

if [ -f "$CONFIG_FILE" ]; then
  echo "Injecting runtime configuration..."

  sed -i "s|PLACEHOLDER_SUPABASE_URL|${VITE_SUPABASE_URL:-}|g" "$CONFIG_FILE"
  sed -i "s|PLACEHOLDER_SUPABASE_ANON_KEY|${VITE_SUPABASE_ANON_KEY:-}|g" "$CONFIG_FILE"

  echo "Configuration injected successfully"
fi

# 启动 Nginx
exec nginx -g 'daemon off;'
