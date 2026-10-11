"""Пути фабрики вещей: папки фото (raw) и результата (out), размер текстур, виды «верха»."""
import json, os, sys, glob
import numpy as np, cv2


HERE = os.path.dirname(os.path.abspath(__file__))


RAW, OUT = os.path.join(HERE, 'raw'), os.path.join(HERE, 'out')


TOPS = {'tee', 'sweater', 'hoodie', 'jacket', 'shirt', 'coat', 'puffer', 'dress'}


TEX_W, TEX_H = 512, 640


HANG_K = 0.72          # калибровка по футболке Zolla: лёжа 1.31, на вешалке 1.82
