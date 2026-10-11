// Спрайт с надписью (подписи вида сверху).
import * as THREE from 'three';
import {canvasTex, fitFont, rr} from '../render/canvas.js';

export function sprite(text,bg){
 const t=canvasTex(512,112,(g,w,h)=>{rr(g,4,8,w-8,h-16,26);g.fillStyle=bg;g.fill();g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';fitFont(g,text,w-60,46,700);g.fillText(text,w/2,h/2+2);});
 const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,toneMapped:false}));sp.scale.set(5,1.1,1);return sp;
}
