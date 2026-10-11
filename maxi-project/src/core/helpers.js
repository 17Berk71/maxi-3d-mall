// Мелкие помощники: $ (элемент по id), V3, LIN (цвет sRGB → линейный).
import * as THREE from 'three';
export let $, V3, LIN;

// по порядку, при запуске
export function init() {

$ = id=>document.getElementById(id);
V3 = THREE.Vector3;
LIN = hex=>new THREE.Color(hex).convertSRGBToLinear();
}
