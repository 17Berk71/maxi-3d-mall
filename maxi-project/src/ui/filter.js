// Фильтр по категориям (фишки).
import {$, LIN} from '../core/helpers.js';
import {CATS} from '../mall/categories.js';
import {S} from '../mall/stores.js';
import {kioskBody, kioskGlow, world} from '../mall/world.js';
import {drawMiniBase} from './minimap.js';
import {app} from '../core/state.js';

/* ---------- Фильтр ---------- */
export function buildChips(){const box=$('chips');
 Object.entries(CATS).forEach(([k,c])=>{if(k==='tbd'||!S.some(s=>s.cat===k))return;const b=document.createElement('button');b.className='chip';const i=document.createElement('i');i.style.background=c.c;b.appendChild(i);b.appendChild(document.createTextNode(c.n));
  b.onclick=()=>{app.filter=app.filter===k?null:k;[...box.children].forEach(x=>x.classList.remove('on'));if(app.filter)b.classList.add('on');applyFilter();drawMiniBase();};box.appendChild(b);});}
function applyFilter(){const dim=LIN('#d9dcdf');
 [1,2].forEach(f=>{const m=world.tint[f];if(!m)return;const attr=m.geometry.attributes.color,arr=attr.array,base=world.tintColors[f],fs=m.userData.fs;
  for(let q=0;q<fs.length;q++){const s=S[fs[q]];const on=!app.filter||(s&&s.cat===app.filter);for(let v=0;v<3;v++){const i=(q*3+v)*3;
   if(on){arr[i]=base[i];arr[i+1]=base[i+1];arr[i+2]=base[i+2];}else{arr[i]=dim.r;arr[i+1]=dim.g;arr[i+2]=dim.b;}}}
  attr.needsUpdate=true;});
 const dimC=LIN('#c9cdd1');world.kSets.forEach(({body,rings,ids})=>{ids.forEach((id,i)=>{const s=S[id];const on=!app.filter||s.cat===app.filter;body.setColorAt(i,on?kioskBody(s):dimC);rings.forEach(r=>r.setColorAt(i,on?kioskGlow(s):dimC));});
  [body,...rings].forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;});});}
