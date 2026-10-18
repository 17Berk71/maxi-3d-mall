#!/bin/bash
# build_chunks.sh [N] — собрать все вещи из raw/wb_items.json, которых ещё нет в out/, по N (8) на процесс:
# у сети вырезания (U2Net) память копится, отдельный процесс на пачку её отпускает.
cd "$(dirname "$0")/../.."; N=${1:-8}
ids=$(python3 -c "
import json,os;L=json.load(open('tools/wardrobe/raw/wb_items.json'))
print(' '.join(x['id'] for x in L if not os.path.exists('tools/wardrobe/out/'+x['id']+'/meta.json')))")
set -- $ids
while [ $# -gt 0 ]; do
  chunk="${@:1:$N}"; shift $(( $# < N ? $# : N ))
  python3 -u tools/wardrobe/build.py $chunk 2>&1 | grep --line-buffered -E "^(ok|FAIL)|Error" | cut -c1-160
done
