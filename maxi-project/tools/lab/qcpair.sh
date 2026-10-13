#!/bin/bash
# qcpair.sh id1,id2 [BODY] — автопроверка на прежней фигуре и на манекене по сетке рядом (X=__oldBody — прежняя)
cd "$(dirname "$0")"; S=${OUTD:-/tmp}
timeout 590 node qc.mjs "$1" 2>&1 | grep -v "^T " | cut -c1-170 > $S/qc_new.txt
X=__oldBody timeout 590 node qc.mjs "$1" 2>&1 | grep -v "^T " | awk '{print $1, $2}' > $S/qc_old.txt
paste -d'|' $S/qc_old.txt $S/qc_new.txt
