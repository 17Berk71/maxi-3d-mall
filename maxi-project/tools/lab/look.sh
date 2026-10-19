#!/bin/bash
# look.sh ПАПКА m|f id1,id2 [X=флаги] [SRC=папка src] — снять вещи (спереди, с маской) и посчитать похожесть на фото (appearance.py).
# SRC — собрать страницу из другой копии исходников (например, рабочей копии git worktree) в www/look.html.
OUT=$1; B=$2; IDS=$3; XF=$4
cd "$(dirname "$0")"
if [ -n "$SRC" ]; then SRC=$SRC OUT=look.html node make.mjs >/dev/null; PG=look.html; else node make.mjs >/dev/null; PG=index.html; fi
rm -rf "$OUT"; mkdir -p "$OUT"
PAGE=$PG OUTD=$OUT BODY=$B V=${V:-0} X=$XF node batch.mjs $IDS 2>&1 | grep -v "GL Driver"
python3 appearance.py "$OUT" >/dev/null && python3 -c "
import json
for l in open('$OUT/look.jsonl'):
  r=json.loads(l); f=r['views'].get('front',{}); print(r['id'],'расчёт',r['phys'],'похожесть',r['look'],r['pens'],'нет:',r.get('missing'))"
