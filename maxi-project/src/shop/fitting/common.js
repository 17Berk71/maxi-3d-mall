// Общее для примерочной: ключи хранилища, LIN, названия слотов.
import * as THREE from 'three';

export const WKEY = 'maxi-wardrobe', LKEY = 'maxi-looks';
export const LIN = h => new THREE.Color(h).convertSRGBToLinear();
export const SLOT_T = {top: 'Верх', outer: 'Верхняя одежда', bottom: 'Низ', dress: 'Платье', shoes: 'Обувь'};
const SLOT_ORDER = ['outer', 'dress', 'top', 'bottom', 'shoes'];
