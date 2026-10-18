#!/bin/bash
# round.sh R — пересобрать все вещи и снять их заново в shots/R (по готовности фабрики, двумя потоками съёмки нельзя — память)
R=${1:-r2}
cd /home/claude/maxi-3d-mall/maxi-project/tools/wardrobe
python3 wb_items.py | head -1
rm -rf out/wb-*
python3 - <<'PY'
import json,os
idx=[json.load(open(os.path.join('out',d,'meta.json'))) for d in sorted(os.listdir('out')) if os.path.exists(os.path.join('out',d,'meta.json'))]
json.dump(idx,open('out/index.json','w'),ensure_ascii=False,indent=1)
PY
./build_chunks.sh 8 > /tmp/claude-0/build_$R.log 2>&1 &
BPID=$!
cd ../lab; ./serve.sh > /dev/null; node make.mjs > /dev/null
OUTD=shots/$R; mkdir -p $OUTD; touch $OUTD/qc.jsonl
while true; do
  read M F <<< $(OUTD=$OUTD python3 - <<'PY'
import json,os
L={x['id']:x for x in json.load(open('../wardrobe/raw/wb_items.json'))}
idx={x['id'] for x in json.load(open('../wardrobe/out/index.json'))}
done={json.loads(l)['id'] for l in open(os.environ['OUTD']+'/qc.jsonl') if l.strip()}
todo=[i for i in L if i in idx and i not in done]
m=[i for i in todo if L[i].get('who')!='women'][:6]; f=[i for i in todo if L[i].get('who')=='women'][:6]
print(','.join(m) or '-', ','.join(f) or '-')
PY
)
  if [ "$M" = "-" ] && [ "$F" = "-" ]; then
    if ! kill -0 $BPID 2>/dev/null; then echo "всё снято"; break; fi
    sleep 30; continue
  fi
  [ "$M" != "-" ] && OUTD=$OUTD BODY=m node batch.mjs $M 2>&1 | grep -v "GL Driver"
  [ "$F" != "-" ] && OUTD=$OUTD BODY=f node batch.mjs $F 2>&1 | grep -v "GL Driver"
done
