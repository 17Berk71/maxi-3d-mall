#!/bin/bash
# Автопроверка гардероба: каждая вещь (и каждое состояние) надевается на фигуру, ткань рассчитывается,
# проверка (fitting.js → qcCloth) ставит балл. Итог — tools/wardrobe/out/qc_report.html и qc.json.
# BODY='{"sex":"m","height":186,...}' — фигура (по умолчанию мерки пользователя). Нужны node + playwright + chromium.
set -e
cd "$(dirname "$0")"
W=work; mkdir -p $W
node make.mjs $W
cp -f ../../../node_modules/three/build/three.min.js $W/ 2>/dev/null || cp -f "${THREE_JS:?нужен three.min.js r128 (THREE_JS=путь)}" $W/
ln -sfn "$(cd ../out && pwd)" $W/wardrobe
PORT=${PORT:-8093}
python3 -m http.server $PORT -d $W > $W/srv.log 2>&1 & SP=$!
trap "kill $SP" EXIT; sleep 1
URL=http://localhost:$PORT/index.html OUT=../out node qc.mjs
