#!/bin/bash
# make-rev.sh REV [имя.html] — страница лаборатории из версии git (коммит, ветка, HEAD~1) для сравнения «до/после»:
#   ./make-rev.sh HEAD before.html  →  PAGE=before.html node shot.mjs old sk-pleat
cd "$(dirname "$0")"; REV=${1:-HEAD}; OUT=${2:-rev.html}; T=$(mktemp -d)
git -C ../.. archive "$REV" src | tar -x -C "$T" && SRC="$T/src" OUT="$OUT" node make.mjs; rm -rf "$T"
