// Сетка проходимости обоих этажей: где можно ходить, проёмы галереи, правка маски (двери, колонны),
// поиск ближайшего свободного места.
import {D, D2} from '../app.js';
import {blockedF} from '../controls/move.js';
import {app} from '../core/state.js';
export let CELL, GW, GH, toPx, fromPx, voidPolys, walk2, hall2, GRIDS;
let GR, raw, walk, baseWalk, base2, BASES;

export function inPoly(v,x,z){let ins=false;for(let i=0,j=v.length-1;i<v.length;j=i++){const a=v[i],b=v[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1]+1e-9)+a[0]))ins=!ins;}return ins;}
export function inVoid(x,z){for(const v of voidPolys)if(inPoly(v,x,z))return true;return false;}
// чистка карты первого этажа: срезаем «усы» и щели уже ~1,3 м (артефакты разметки у витрин)
function openMask(m,r){const t=new Uint8Array(m.length),o=new Uint8Array(m.length);
 for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){let v=1;for(let dj=-r;dj<=r&&v;dj++)for(let di=-r;di<=r;di++){if(di*di+dj*dj>r*r+1)continue;const a=i+di,b=j+dj;if(a<0||b<0||a>=GW||b>=GH||!m[b*GW+a]){v=0;break;}}t[j*GW+i]=v;}
 for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){if(!m[j*GW+i])continue;let v=0;for(let dj=-r;dj<=r&&!v;dj++)for(let di=-r;di<=r;di++){if(di*di+dj*dj>r*r+1)continue;const a=i+di,b=j+dj;if(a>=0&&b>=0&&a<GW&&b<GH&&t[b*GW+a]){v=1;break;}}o[j*GW+i]=v;}
 return o;}
// галерея второго этажа — из карты второго этажа (tools/pipeline/f2seg.py), та же сетка
function unpack(b64){const r=atob(b64),o=new Uint8Array(GW*GH);for(let i=0;i<r.length;i++){const b=r.charCodeAt(i);for(let k=0;k<8;k++){const j=i*8+k;if(j<o.length)o[j]=(b>>(7-k))&1;}}return o;}
export function isWalkF(f,x,z){const [i,j]=toPx(x,z);return i>=0&&j>=0&&i<GW&&j<GH&&GRIDS[f][j*GW+i]===1;}
export function isWalkPx(i,j){return i>=0&&j>=0&&i<GW&&j<GH&&walk[j*GW+i]===1;}
export function isWalk(x,z){return isWalkF(app.curFloor,x,z);}
export function isFloorF(f,x,z){const [i,j]=toPx(x,z);return i>=0&&j>=0&&i<GW&&j<GH&&BASES[f][j*GW+i]===1;}
function isFloor(x,z){return isFloorF(1,x,z);}
export function setRect(cx,cz,a,hl,hw,val,f){const g=GRIDS[f||1];const ca=Math.cos(a),sa=Math.sin(a),r=Math.hypot(hl,hw)/CELL+1;const [pi,pj]=toPx(cx,cz);
 for(let j=Math.floor(pj-r);j<=pj+r;j++)for(let i=Math.floor(pi-r);i<=pi+r;i++){if(i<0||j<0||i>=GW||j>=GH)continue;const [x,z]=fromPx(i,j);const dx=x-cx,dz=z-cz;const lx=dx*ca+dz*sa,lz=-dx*sa+dz*ca;if(Math.abs(lx)<=hl&&Math.abs(lz)<=hw)g[j*GW+i]=val;}}
export function blockRect(cx,cz,a,hl,hw,f){setRect(cx,cz,a,hl,hw,0,f);}
// ближайшая свободная точка этажа где угодно (если рядом этажа нет)
// свободное место вокруг точки: расстояние до ближайшей стены/витрины (по исходной карте этажа), м
export function clearance(f,x,z,maxM){const [pi,pj]=toPx(x,z),R=Math.ceil((maxM||5)/CELL);let best=(maxM||5);
 for(let j=-R;j<=R;j++)for(let i=-R;i<=R;i++){const a=pi+i,b=pj+j;const d=Math.hypot(i,j)*CELL;if(d>=best)continue;if(a<0||b<0||a>=GW||b>=GH||!BASES[f][b*GW+a])best=d;}return best;}
// колонна остаётся, только если вокруг неё просторно на обоих этажах и она не пробивает магазин второго этажа
export function keepColumn(p){const [x,z]=p;if(!isFloorF(1,x,z)||clearance(1,x,z)<3.2)return false;
 const v=inVoid(x,z),f2=isFloorF(2,x,z);if(!v&&!f2)return false;if(f2&&clearance(2,x,z)<3.2)return false;
 for(const e of D2.esc){const dx=x-e.p[0],dz=z-e.p[1],ca=Math.cos(e.a),sa=Math.sin(e.a);if(Math.abs(dx*ca+dz*sa)<7.5&&Math.abs(-dx*sa+dz*ca)<3.5)return false;}
 return true;}
export function nearestAny(f,x,z){let best=null,bd=1e18;for(let j=0;j<GH;j+=2)for(let i=0;i<GW;i+=2){if(!GRIDS[f][j*GW+i])continue;const [cx,cz]=fromPx(i,j);const d=(cx-x)**2+(cz-z)**2;if(d<bd&&!blockedF(f,cx,cz)){bd=d;best=[cx,cz];}}return best;}
export function nearestFree(x,z,maxR,f){const [pi,pj]=toPx(x,z);f=f||app.curFloor;
 for(let r=0;r<(maxR||80);r++){let best=null,bd=1e9;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const [cx,cz]=fromPx(pi+dx,pj+dy);if(!blockedF(f,cx,cz)){const d=dx*dx+dy*dy;if(d<bd){bd=d;best=[cx,cz];}}}if(best)return best;}return null;}

// по порядку, при запуске
export function init() {

/* ---------- Проходимость: своя сетка у каждого этажа ---------- */
GR = D.grid; CELL = GR.cell; GW = GR.W; GH = GR.H;
raw = atob(GR.b64);walk = new Uint8Array(GW*GH);
for(let i=0;i<raw.length;i++){const b=raw.charCodeAt(i);for(let k=0;k<8;k++){const j=i*8+k;if(j<walk.length)walk[j]=(b>>(7-k))&1;}}
toPx = (x,z)=>[Math.floor((x-GR.x0)/CELL),Math.floor((z-GR.z0)/CELL)];
fromPx = (i,j)=>[GR.x0+(i+.5)*CELL,GR.z0+(j+.5)*CELL];
// проёмы галереи — по карте второго этажа (над коридорами первого)
voidPolys = D2.voids;
walk.set(openMask(walk,2));
baseWalk = walk.slice();
walk2 = unpack(D2.walk.b64); hall2 = unpack(D2.hall.b64);
base2 = walk2.slice();
GRIDS = {1:walk,2:walk2}; BASES = {1:baseWalk,2:base2};
app.curFloor = 1;
}
