"""Яркость и баланс белого фото на вешалке — к стене на фото «на человеке»."""
import json, os, sys, glob
import numpy as np, cv2


WALL_REF = np.array([140., 148., 140.])   # стена в комнате на фото «на человеке» (RGB): к ней приводим яркость и цвет фото вещей


def wall_gain(im):
    """Фото на вешалке: стена по краям кадра → множители по каналам, чтобы стена совпала с эталоном (выдержка и баланс белого)."""
    h, w = im.shape[:2]
    band = np.concatenate([im[int(h * .35):int(h * .65), :int(w * .04)].reshape(-1, 3), im[int(h * .35):int(h * .65), -int(w * .04):].reshape(-1, 3)])
    wall = np.median(band, 0)[::-1].astype(float)
    g = WALL_REF / np.maximum(wall, 1)
    return np.clip(g, 0.45, 1.6)


def apply_gain(img, g):
    return np.clip(img.astype(np.float32) * g[::-1].reshape(1, 1, 3), 0, 255).astype(np.uint8)
