#!/bin/sh
cd "$(dirname "$0")"
[ -d node_modules/busboy ] || npm install --omit=dev >/dev/null 2>&1
mkdir -p shared uploads
echo ""
echo "  LanShare Server"
echo "  Phone connect: http://YOUR_PC_IP:8787"
echo ""
exec node server.mjs
