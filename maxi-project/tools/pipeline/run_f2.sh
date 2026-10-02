#!/usr/bin/env bash
# Пересобирает второй этаж (src/data/maxi-floor2.json) из скриншотов Яндекс Карт второго этажа.
# Требуется: python3, numpy, opencv-python, scipy, pillow. Первый этаж (maxi-data.json) должен быть готов.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p work_f2
echo "1/2 привязка подробных снимков к обзорному"; python3 f2reg.py
echo "2/2 помещения, коридоры, проёмы, эскалаторы, привязка к первому этажу"; python3 f2seg.py
python3 healf2.py
python3 fillnames.py
echo "Готово: src/data/maxi-floor2.json, превью — tools/pipeline/work_f2/preview.png"
