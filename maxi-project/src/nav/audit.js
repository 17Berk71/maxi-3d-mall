// Проверка карты: все ли двери достижимы, узкие места.
import {D} from '../app.js';
import {blockedF} from '../controls/move.js';
import {world} from '../mall/world.js';
import {CELL, GH, GRIDS, GW, fromPx, nearestAny, nearestFree, toPx} from './walkgrid.js';

/* ---------- Проверка карты: можно ли везде пройти, не протискиваясь ---------- */
export function auditMap(){const res={};
 [1,2].forEach(f=>{const N=GW*GH,nav=new Uint8Array(N);
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=j*GW+i;if(!GRIDS[f][k])continue;const [x,z]=fromPx(i,j);if(!blockedF(f,x,z))nav[k]=1;}
  // старт: у входа 2 на первом этаже, у лифта на втором
  let sx,sz;if(f===1){const e=D.ents.find(e=>e.n===2)||D.ents[0];sx=e.p[0]-e.d[0]*6;sz=e.p[1]-e.d[1]*6;}else{const L=world.lifts[0];sx=L.c.x+L.n.x*(L.HL+1.6);sz=L.c.z+L.n.z*(L.HL+1.6);}
  const st=nearestFree(sx,sz,80,f)||nearestAny(f,sx,sz);const [si,sj]=toPx(st[0],st[1]);
  const seen=new Uint8Array(N),q=new Int32Array(N);let h=0,t=0;q[t++]=sj*GW+si;seen[sj*GW+si]=1;
  while(h<t){const k=q[h++],i=k%GW,j=(k/GW)|0;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=GW||b>=GH)continue;const kk=b*GW+a;if(nav[kk]&&!seen[kk]){seen[kk]=1;q[t++]=kk;}}}
  let navN=0;for(let k=0;k<N;k++)navN+=nav[k];
  // двери: точка перед дверью должна быть достижима
  const bad=[];world.doors.filter(s=>s.door.floor===f).forEach(s=>{const d=s.door;let ok=false;
   for(let r=0.6;r<=2.4&&!ok;r+=0.3)for(let l=-0.6;l<=0.6&&!ok;l+=0.3){const x=d.c.x+d.n.x*r+d.R.x*l,z=d.c.z+d.n.z*r+d.R.z*l;const [i,j]=toPx(x,z);if(i>=0&&j>=0&&i<GW&&j<GH&&seen[j*GW+i])ok=true;}
   if(!ok)bad.push(s.name);});
  // узкие места: проход уже 1,8 м (расстояние до препятствия с учётом плеч < 0,55 м)
  const dist=new Float32Array(N).fill(1e9);for(let k=0;k<N;k++)if(!nav[k])dist[k]=0;
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=j*GW+i;if(!dist[k])continue;let v=dist[k];if(i>0)v=Math.min(v,dist[k-1]+1);if(j>0)v=Math.min(v,dist[k-GW]+1);if(i>0&&j>0)v=Math.min(v,dist[k-GW-1]+1.414);if(i<GW-1&&j>0)v=Math.min(v,dist[k-GW+1]+1.414);dist[k]=v;}
  for(let j=GH-1;j>=0;j--)for(let i=GW-1;i>=0;i--){const k=j*GW+i;if(!dist[k])continue;let v=dist[k];if(i<GW-1)v=Math.min(v,dist[k+1]+1);if(j<GH-1)v=Math.min(v,dist[k+GW]+1);if(i<GW-1&&j<GH-1)v=Math.min(v,dist[k+GW+1]+1.414);if(i>0&&j<GH-1)v=Math.min(v,dist[k+GW-1]+1.414);dist[k]=v;}
  const nearDoor=(x,z)=>world.doors.some(s=>s.door.floor===f&&Math.hypot(x-s.door.c.x,z-s.door.c.z)<3);
  const narrow=[];for(let j=1;j<GH-1;j+=2)for(let i=1;i<GW-1;i+=2){const k=j*GW+i;if(!seen[k])continue;const dm=dist[k]*CELL;
   // точка на средней линии прохода (локальный максимум), а проход узкий
   if(dm<0.55&&dist[k]>=dist[k-1]&&dist[k]>=dist[k+1]&&dist[k]>=dist[k-GW]&&dist[k]>=dist[k+GW]){const [x,z]=fromPx(i,j);if(!nearDoor(x,z))narrow.push([+x.toFixed(1),+z.toFixed(1)]);}}
  res[f]={reachable:+(t/navN).toFixed(3),doors:world.doors.filter(s=>s.door.floor===f).length,unreachableDoors:bad,narrow:narrow.length,narrowAt:narrow};});
 res.columns={kept:world.colsKept,dropped:world.colsDropped};return res;}
