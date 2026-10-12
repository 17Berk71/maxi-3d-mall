#!/bin/bash
# rev-qc.sh REV имя.html — страница лаборатории из версии git, но с текущей автопроверкой (src/shop/fitting/qc.js):
#   старые версии вещей проверяются той же проверкой, что и новая (эталон «плохих» версий)
cd "$(dirname "$0")"; REV=${1:-HEAD}; OUT=${2:-rev.html}; T=$(mktemp -d)
git -C ../.. archive "$REV" src | tar -x -C "$T" && cp ../../src/shop/fitting/qc.js "$T/src/shop/fitting/qc.js" && SRC="$T/src" OUT="$OUT" node make.mjs; rm -rf "$T"
