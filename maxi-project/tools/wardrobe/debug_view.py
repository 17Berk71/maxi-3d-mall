"""Картинка для проверки: маска, верх/низ, края корпуса, шаг."""
import json, os, sys, glob
import numpy as np, cv2


def overlay(im, m, info, kind):
    o = im.copy()
    o[m == 0] = (o[m == 0] * .25).astype(np.uint8)
    cv2.line(o, (0, info['top']), (o.shape[1], info['top']), (0, 255, 255), 3)
    cv2.line(o, (0, info['bot']), (o.shape[1], info['bot']), (0, 255, 255), 3)
    if 'spans' in info:
        for y in range(info['top'], info['bot'], 3):
            a, b = info['spans'](y)
            cv2.circle(o, (int(a), y), 2, (255, 0, 255), -1); cv2.circle(o, (int(b), y), 2, (255, 0, 255), -1)
        cv2.line(o, (0, info['arm']), (o.shape[1], info['arm']), (0, 160, 255), 2)
    elif 'hw' in info:
        for x in (info['cx'] - info['hw'], info['cx'] + info['hw']):
            cv2.line(o, (int(x), info['top']), (int(x), info['bot']), (255, 0, 255), 3)
    if 'crotch' in info:
        cv2.line(o, (0, info['crotch']), (o.shape[1], info['crotch']), (255, 0, 255), 3)
    return o
