import * as THREE from 'three';

// Детерминированный генератор случайных чисел (одинаковые результаты при каждом запуске)
export function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}

// Осветлить (amt>0) или затемнить (amt<0) цвет в формате #rrggbb
export function shade(hex,amt){const c=new THREE.Color(hex);return '#'+c.lerp(new THREE.Color(amt>0?'#ffffff':'#000000'),Math.abs(amt)).getHexString();}
