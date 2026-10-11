#!/bin/bash
# mkvid.sh NAME OUT.mp4 — кадры shots/anim_NAME_*.png (15 к/с) → видео 30 к/с с промежуточными кадрами, в конце пауза 1 с (нужен ffmpeg)
cd "$(dirname "$0")"; T=vid/$1; rm -rf "$T"; mkdir -p "$T"; i=0
for f in $(ls shots/anim_$1_*.png | sort); do cp "$f" "$T/f_$(printf %03d $i).png"; i=$((i+1)); done
last=$(ls "$T"/f_*.png | sort | tail -1); for k in $(seq 1 15); do cp "$last" "$T/f_$(printf %03d $i).png"; i=$((i+1)); done
ffmpeg -y -loglevel error -framerate 15 -i "$T/f_%03d.png" -vf "minterpolate=fps=30:mi_mode=blend,format=yuv420p" -c:v libx264 -crf 18 "$2" && ls -la "$2"
