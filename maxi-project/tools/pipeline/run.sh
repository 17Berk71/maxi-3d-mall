#!/usr/bin/env bash
# Пересобирает данные карты (src/data/maxi-data.json) из скриншотов Яндекс Карт и схемы ТРЦ.
# Требуется: python3, numpy, opencv-python, scipy, scikit-image, pillow, matplotlib (только для проверок)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$HERE/work"
rm -rf "$WORK"; mkdir -p "$WORK"
cp "$HERE"/*.py "$WORK"/
cp "$HERE"/source/plan.png "$HERE"/source/y{E,M,W,F,N}.png "$WORK"/
cd "$WORK"
echo "1/8 контур здания по схеме ТРЦ";        python3 ex.py
echo "2/8 уточнение контура";                 python3 ex2.py
echo "3/8 склейка скриншотов Яндекс Карт";    python3 mosaic.py
echo "4/8 разметка помещений и коридоров";   python3 seg.py
echo "5/8 чистка, островки";                  python3 seg2.py
echo "6/8 названия, выпрямление, галереи, колонны, эскалаторы, входы"; python3 gen4.py
echo "7/8 проверка связности коридоров";      python3 repair.py
echo "8/8 картинка вида сверху для сверки";   python3 preview.py
cp maxi_data2.json "$HERE/../../src/data/maxi-data.json"
cp preview.png "$HERE/../../docs/screenshots/layout-top.png"
python3 esccheck.py
python3 fillnames.py
echo "Готово: src/data/maxi-data.json обновлён, превью — docs/screenshots/layout-top.png"
