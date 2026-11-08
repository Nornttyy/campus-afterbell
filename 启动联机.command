#!/bin/zsh
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "${0:A:h}"
if ! command -v node >/dev/null; then
  print '未找到 Node.js，请先安装 Node.js 后再打开。'
  read '?按回车关闭'
  exit 1
fi
if curl --silent --fail --max-time 2 http://127.0.0.1:8931/api/health >/dev/null 2>&1; then
  print '联机服务已经运行。浏览器打开 http://127.0.0.1:8931/'
  read '?按回车关闭这个提示窗口'
  exit 0
fi
print '浏览器打开 http://127.0.0.1:8931/'
print '一位玩家创建房间，另一位输入相同房间号。至少两人才能开始。'
print '同一 Wi-Fi 的设备使用这台电脑的局域网地址和端口 8931。'
print '游戏运行时请保持此窗口打开。Ctrl+C 停止服务器。'
exec node server/server.js
