// Список помещений и островков обоих этажей (массив S) из данных карты.
import * as THREE from 'three';
import {D, D2} from '../app.js';
import {CATS} from './categories.js';
export let S;

// по порядку, при запуске
export function init() {

/* ---------- Данные ---------- */
S = [];
D.stores.forEach(s=>S.push(Object.assign({kind:'store',floor:1},s)));
D.kiosks.forEach(k=>S.push(Object.assign({kind:'kiosk',floor:1,c:k.p,area:Math.round(k.w*k.h)},k)));
D2.stores.forEach(s=>S.push(Object.assign({kind:'store',floor:2},s)));
D2.kiosks.forEach(k=>S.push(Object.assign({kind:'kiosk',floor:2,c:k.p,area:Math.round(k.w*k.h)},k)));
S.forEach((s,i)=>{s.id=i;if(!s.name)s.name=s.kind==='kiosk'?'Островок':'Помещение без подписи';});
S.forEach(s=>{const v=(s.id*37)%21-10,w=(s.id*53)%7-3;
 const c=new THREE.Color();if(s.cat==='tbd')c.setHSL(210/360,0.08,0.80+w*0.012);else c.setHSL((((CATS[s.cat].h+v)%360)+360)%360/360,0.55,0.55+w*0.03);
 s.colHex='#'+c.getHexString();s.col=c.clone().convertSRGBToLinear();});
}
