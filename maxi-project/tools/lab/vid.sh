#!/bin/bash
# vid.sh NAME '["id1"]' [1|2] — кадры анимации через один (15 к/с), страница 480×720. Длинная анимация — в два захода: 1, потом 2
cd "$(dirname "$0")"; NAME=$1; J=$2; PART=${3:-all}
./serve.sh > /dev/null || exit 1
case "$PART" in 1) rm -f shots/anim_${NAME}_*.png; K0=0; KE=68;; 2) K0=68; KE=140;; *) rm -f shots/anim_${NAME}_*.png; K0=0; KE=140;; esac
VW=480 VH=720 WAIT=150 STEP=2 K0=$K0 KEND=$KE node anim.mjs "$NAME" "$J" 2>&1 | grep -E "расчёт|PAGEERR|кадров"
