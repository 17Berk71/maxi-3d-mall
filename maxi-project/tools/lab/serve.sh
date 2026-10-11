#!/bin/bash
# serve.sh — собрать страницу лаборатории и поднять сервер www/ на PORT (8091), если ещё не поднят
cd "$(dirname "$0")"; PORT=${PORT:-8091}
node make.mjs || exit 1
if ! curl -s -o /dev/null "localhost:$PORT/index.html"; then (cd www && setsid nohup python3 -m http.server "$PORT" > ../server.log 2>&1 &); sleep 1; fi
echo "http://localhost:$PORT/index.html"
