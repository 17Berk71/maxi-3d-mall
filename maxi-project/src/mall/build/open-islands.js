// Открытые помещения посреди коридора и фасады помещений обоих этажей (вызов fronts).
import {S} from '../stores.js';
import {FLOORS} from '../world.js';
import {inPoly, isFloorF} from '../../nav/walkgrid.js';
import {fronts} from './fronts.js';

// по порядку, при запуске
export function init() {

 // помещения без подписи посреди коридора (со всех сторон проход) — открытые островки в половину высоты
 S.forEach(s=>{if(s.kind!=='store'||s.cat==='wc'||s.area>(s.cat==='tbd'?40:12))return;const P=s.poly;let tot=0,ok=0;
  for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1e-6)continue;const tx=(b[0]-a[0])/L,tz=(b[1]-a[1])/L;
   for(let u=0.25;u<L;u+=0.5){const px=a[0]+tx*u,pz=a[1]+tz*u;let nx=-tz,nz=tx;if(inPoly(P,px+nx*0.3,pz+nz*0.3)){nx=-nx;nz=-nz;}tot++;if(isFloorF(s.floor,px+nx*0.9,pz+nz*0.9))ok++;}}
  if(tot&&ok/tot>=0.7)s.island=true;});
 fronts(FLOORS[1],S.filter(s=>s.kind==='store'&&s.floor===1));
 fronts(FLOORS[2],S.filter(s=>s.kind==='store'&&s.floor===2));
}
