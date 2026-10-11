// 3D-товары и фото-вещи для залов: модели из частей, фото на вешалах, места на полках.
import * as THREE from 'three';
import {deptsFor, PHOTOS} from './catalog.js';
import {createModels} from './models.js';
import {winKeys} from './feeds.js';
import {canvasTex} from '../render/canvas.js';
import {Merger} from '../render/merger.js';
export let B, Cy, CyX, MOD, SLOT, GARM;
let photoTexCache;

/* =====================================================================
   Магазины изнутри: вход через дверь, зал с отделами, компактный каталог
   ===================================================================== */

/* ---------- 3D-модели товаров и оборудования ---------- */
export function mergeG(gs){const m=new Merger();gs.forEach(g=>m.add(g));const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(m.p,3));bg.setAttribute('normal',new THREE.Float32BufferAttribute(m.n,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(m.u,2));return bg;}
export function models(){if(!MOD)MOD=createModels(canvasTex);return MOD.M;}
function photoTex(k){if(photoTexCache[k])return photoTexCache[k];const t=new THREE.TextureLoader().load(PHOTOS[k].url);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return photoTexCache[k]=t;}
export function photoMat(k){return new THREE.MeshStandardMaterial({map:photoTex(k),alphaTest:0.45,side:THREE.DoubleSide,roughness:.85});}
export function photoGeo(k){const P=PHOTOS[k];return new THREE.PlaneGeometry(P.h*P.aspect,P.h);}
// какие фото-вещи уместны в магазине: только если в его ассортименте есть такой отдел
export function photoKeysFor(s){if(s._ph)return s._ph;const wk=winKeys(s.name);if(wk.length)return s._ph=wk;const d=deptsFor(s),o=[];if(d.includes('tshirts'))o.push('tee_black');if(d.includes('jackets'))o.push('puffer_red');if(d.includes('pants'))o.push('trousers_beige');return s._ph=o;}

// по порядку, при запуске
export function init() {

B = (w,h,d,x,y,z)=>new THREE.BoxGeometry(w,h,d).translate(x||0,y||0,z||0);
Cy = (r1,r2,h,x,y,z,seg)=>new THREE.CylinderGeometry(r1,r2,h,seg||12).translate(x||0,y||0,z||0);
// горизонтальный цилиндр вдоль X: сначала поворот, потом сдвиг
CyX = (r,h,x,y,z,seg)=>new THREE.CylinderGeometry(r,r,h,seg||12).rotateZ(Math.PI/2).translate(x||0,y||0,z||0);
MOD = null;
// ширина места на полке под товар (м)
// фото настоящих вещей: текстура с прозрачным фоном, плоскость по размеру вещи
photoTexCache = {};
SLOT = {shoe:.36,box:.3,jar:.13,tube:.075,bottle:.12,book:.055,toy:.3,small:.15,phone:.13,laptop:.44,tv:1.25,dumbbell:.42,cup:.13,ticket:.24,football:.26,basketball:.28,appliance:.8,sofa:2.2,bed:1.8,bike:1.2,jacket:.13,tshirt:.1,longsleeve:.11,pants:.1,dress:.12};
GARM = {jacket:1,pants:1,tshirt:1,longsleeve:1,dress:1};
}
