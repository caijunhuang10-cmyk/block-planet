#!/bin/zsh
set -u

PROJECT_DIR="${0:A:h:h}"
cd "$PROJECT_DIR" || exit 1

if curl --noproxy '*' --silent --show-error --max-time 2 http://localhost:7897/ >/dev/null 2>&1; then
  open http://localhost:7897/
  exit 0
fi

BUN_BIN="${BUN_BIN:-$(command -v bun 2>/dev/null || true)}"
if [[ -z "$BUN_BIN" ]]; then
  BUN_BIN="/Users/caijunhuang/.bun/bin/bun"
fi
if [[ ! -x "$BUN_BIN" ]]; then
  echo "找不到 Bun，请先安装 Bun。"
  read -r "?按回车退出..."
  exit 1
fi

echo "正在启动方块星球本地服务..."
"$BUN_BIN" run start > /tmp/block-planet-7897.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM

for attempt in {1..30}; do
  if curl --noproxy '*' --silent --show-error --max-time 1 http://localhost:7897/ >/dev/null 2>&1; then
    open http://localhost:7897/
    echo "游戏已打开： http://localhost:7897/"
    wait "$SERVER_PID"
    exit $?
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "本地服务启动失败，日志： /tmp/block-planet-7897.log"
    tail -30 /tmp/block-planet-7897.log 2>/dev/null || true
    read -r "?按回车退出..."
    exit 1
  fi
  sleep 1
done

echo "等待本地服务超时，日志： /tmp/block-planet-7897.log"
read -r "?按回车退出..."
exit 1
