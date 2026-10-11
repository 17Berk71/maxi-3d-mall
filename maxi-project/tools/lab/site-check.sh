#!/bin/bash
# site-check.sh TAG — полная проверка сайта (tools/test/check.mjs) на исходных модулях без сборки; лог → out/check_TAG.log,
# скриншоты → out/check_TAG/. Идёт 15–30 минут (браузер без видеокарты). Известно: в облаке раздел «Телефон вертикально»
# обрывается по таймауту на кнопке второго этажа — так же и на старых версиях; всё до него должно быть с «✓».
cd "$(dirname "$0")"; TAG=${1:-esm}; P=${ESM_PORT:-8095}; mkdir -p out
node make.mjs > /dev/null && node esm-page.mjs > /dev/null || exit 1
# check.mjs берёт playwright из node_modules; без npm install в проекте — ссылка на глобальную установку (облачная песочница)
G=${PLAYWRIGHT_MODULES:-/home/claude/.npm-global/lib/node_modules}
if [ ! -d ../../node_modules/playwright ] && [ ! -e ../test/node_modules ] && [ -d "$G/playwright" ]; then ln -s "$G" ../test/node_modules; fi
(cd www-esm && python3 -m http.server "$P" > ../out/esm_server.log 2>&1) & SP=$!; sleep 1
rm -rf ../test/out; MAXI_URL="http://localhost:$P/?debug" timeout 3000 node ../test/check.mjs > "out/check_$TAG.log" 2>&1; echo "EXIT $?" >> "out/check_$TAG.log"
rm -rf "out/check_$TAG"; cp -r ../test/out "out/check_$TAG" 2>/dev/null; kill $SP
grep -c "✓" "out/check_$TAG.log" | sed 's/^/пройдено: /'; grep "✗" "out/check_$TAG.log"; tail -1 "out/check_$TAG.log"
