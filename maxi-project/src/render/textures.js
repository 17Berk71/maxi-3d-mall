// Общие текстуры: полки витрин, мрамор пола, тень у витрин, пиктограммы категорий, пятно света.
import * as THREE from 'three';
import {mulberry, shade} from '../core/utils.js';
import {CATS} from '../mall/categories.js';
import {canvasTex, rr} from './canvas.js';
export let WEAR_COLS, shelfAtlas, marble, aoTex, pictoAtlas, pictoUV, blobTex;
let catKeys, shelfRows, PICTO_KEYS;

export function shelfUV(cat){const idx=catKeys.indexOf(cat);const cx=idx%4,cy=Math.floor(idx/4);return[cx/4+.004,1-(cy+1)/shelfRows+.004,(cx+1)/4-.004,1-cy/shelfRows-.004];}

// по порядку, при запуске
export function init() {

/* ---------- Текстуры ---------- */
catKeys = Object.keys(CATS);shelfRows = Math.ceil(catKeys.length/4);
// задняя стена магазина: стеллажи с товаром, тёплый свет
WEAR_COLS = ['#1e1f22','#3b3e44','#243447','#3d5a80','#5b6146','#cbb89d','#b08855','#6e2433','#ecebe7','#9ea2a6','#5c4033','#9fb8cf','#d8b4b8','#7a8a6c'];
shelfAtlas = canvasTex(1024,256*shelfRows,(g)=>{
 catKeys.forEach((k,idx)=>{const ox=(idx%4)*256,oy=Math.floor(idx/4)*256,col=shade(CATS[k].c,0),r=mulberry(idx*131+7);const soft=c=>'#'+new THREE.Color(c).lerp(new THREE.Color('#b9b3a8'),0.55).getHexString();
  g.save();g.translate(ox,oy);g.beginPath();g.rect(0,0,256,256);g.clip();
  const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#fbf8f2');gr.addColorStop(1,'#e2dccf');g.fillStyle=gr;g.fillRect(0,0,256,256);
  g.fillStyle='#e9e5de';g.fillRect(0,0,256,26);
  if(k==='tbd'){g.fillStyle='#dcd8d0';g.fillRect(0,0,256,256);g.strokeStyle='rgba(0,0,0,.08)';for(let x=0;x<256;x+=32){g.beginPath();g.moveTo(x,0);g.lineTo(x,256);g.stroke();}}
  else if(k==='fashion'||k==='kids'||k==='sport'){for(let rack=0;rack<2;rack++){const y=62+rack*78;g.fillStyle='#8b8f94';g.fillRect(6,y,244,3);let x=12;while(x<240){const w=7+r()*9,h=40+r()*26;const c=WEAR_COLS[Math.floor(r()*WEAR_COLS.length)];const gg=g.createLinearGradient(x,0,x+w,0);gg.addColorStop(0,shade(c,-.25));gg.addColorStop(.5,c);gg.addColorStop(1,shade(c,-.3));g.fillStyle=gg;rr(g,x,y+3,w,h,3);g.fill();x+=w+1.5;}}}
  else if(k==='food'){g.fillStyle='#3a332c';g.fillRect(14,40,228,56);g.fillStyle='rgba(255,240,210,.85)';for(let i=0;i<3;i++){g.fillRect(28+i*72,52,56,4);g.fillRect(28+i*72,62,40,3);g.fillRect(28+i*72,72,48,3);}
   g.fillStyle='#b98b5e';g.fillRect(0,160,256,96);g.fillStyle='#d8b690';g.fillRect(0,160,256,8);for(let i=0;i<6;i++){g.fillStyle=soft(shade(col,(r()-.5)));g.beginPath();g.arc(24+i*42,150,10,0,7);g.fill();}}
  else if(k==='tech'){g.fillStyle='#f4f4f2';g.fillRect(0,40,256,216);for(let row=0;row<3;row++){g.fillStyle='#d4d4d0';g.fillRect(8,96+row*56,240,4);for(let i=0;i<8;i++){const x=14+i*30,y=56+row*56;g.fillStyle='#16181b';rr(g,x,y,20,36,4);g.fill();g.fillStyle='#1c2733';rr(g,x+2,y+3,16,28,2);g.fill();}}}
  else if(k==='furn'){g.fillStyle='#d9cdbd';g.fillRect(0,196,256,60);for(let i=0;i<2;i++){const x=12+i*124,y=118;const c=soft(shade(col,(r()-.5)*.6));g.fillStyle=shade(c,-.15);rr(g,x,y,110,70,12);g.fill();g.fillStyle=c;rr(g,x+6,y+34,98,32,10);g.fill();}}
  else if(k==='beauty'||k==='acc'||k==='gifts'){for(let row=0;row<4;row++){const y=50+row*48;g.fillStyle='rgba(255,255,255,.9)';g.fillRect(6,y+34,244,4);g.fillStyle='rgba(0,0,0,.08)';g.fillRect(6,y+38,244,3);for(let x=12;x<244;x+=10){const h=8+r()*22;g.fillStyle=soft(shade(col,(r()-.5)*1.1));g.fillRect(x,y+34-h,7,h);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(x+1,y+34-h,2,h);}}}
  else{for(let row=0;row<3;row++){const y=56+row*60;g.fillStyle='#cfc8bb';g.fillRect(0,y+44,256,6);let x=6;while(x<248){const w=12+r()*26,h=18+r()*28;g.fillStyle=soft(shade(col,(r()-.5)*.9));g.fillRect(x,y+44-h,w,h);x+=w+3;}}}
  // мягкая виньетка
  const vg=g.createRadialGradient(128,110,40,128,128,200);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(40,30,20,.28)');g.fillStyle=vg;g.fillRect(0,0,256,256);
  g.restore();});
});
// мраморная плитка пола
marble = canvasTex(1024,1024,(g,w,h)=>{const r=mulberry(11);
 const tiles=4,ts=w/tiles;
 for(let i=0;i<tiles;i++)for(let j=0;j<tiles;j++){const b=Math.floor(r()*9);g.fillStyle=`rgb(${222+b},${209+b},${186+b})`;g.fillRect(i*ts,j*ts,ts,ts);
  for(let v=0;v<5;v++){g.beginPath();let x=i*ts+r()*ts,y=j*ts;g.moveTo(x,y);for(let s=0;s<14;s++){x+=(r()-.5)*40;y+=ts/14;g.lineTo(x,y);}g.strokeStyle=`rgba(150,140,125,${0.05+r()*0.08})`;g.lineWidth=0.6+r()*1.6;g.stroke();}
  for(let s=0;s<260;s++){g.fillStyle=`rgba(120,110,95,${r()*0.05})`;g.fillRect(i*ts+r()*ts,j*ts+r()*ts,2+r()*5,2+r()*5);}}
 g.strokeStyle='rgba(110,96,76,.35)';g.lineWidth=2;for(let i=0;i<=tiles;i++){g.beginPath();g.moveTo(i*ts,0);g.lineTo(i*ts,h);g.moveTo(0,i*ts);g.lineTo(w,i*ts);g.stroke();}
});
marble.wrapS=marble.wrapT=THREE.RepeatWrapping;
// тень у основания витрин
aoTex = canvasTex(8,64,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(0,0,0,.30)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
// световые знаки в витринах: пиктограмма категории, без рекламных обещаний
PICTO_KEYS = Object.keys(CATS);
pictoAtlas = canvasTex(128*PICTO_KEYS.length,128,(g)=>{PICTO_KEYS.forEach((k,i)=>{const x=i*128,cx=x+64,cy=64;
 g.fillStyle='#23272c';rr(g,x+4,4,120,120,22);g.fill();g.strokeStyle=CATS[k].c;g.lineWidth=4;rr(g,x+8,8,112,112,18);g.stroke();
 g.strokeStyle='#f6f3ec';g.fillStyle='#f6f3ec';g.lineWidth=6;g.lineCap='round';g.lineJoin='round';g.beginPath();
 switch(k){
  case'fashion':g.arc(cx,40,8,Math.PI,0.2);g.moveTo(cx+7,45);g.lineTo(cx,56);g.lineTo(cx-34,82);g.lineTo(cx+34,82);g.lineTo(cx,56);g.stroke();break;
  case'food':g.moveTo(cx-24,40);g.lineTo(cx-24,88);g.moveTo(cx-32,40);g.lineTo(cx-32,56);g.quadraticCurveTo(cx-24,66,cx-16,56);g.lineTo(cx-16,40);g.moveTo(cx+18,88);g.lineTo(cx+18,40);g.quadraticCurveTo(cx+34,48,cx+30,66);g.lineTo(cx+18,66);g.stroke();break;
  case'beauty':g.moveTo(cx,34);g.bezierCurveTo(cx+30,64,cx+22,92,cx,92);g.bezierCurveTo(cx-22,92,cx-30,64,cx,34);g.stroke();break;
  case'acc':g.arc(cx-20,70,14,0,7);g.moveTo(cx+34,70);g.arc(cx+20,70,14,0,7);g.moveTo(cx-6,68);g.lineTo(cx+6,68);g.stroke();break;
  case'tech':rr(g,cx-18,32,36,64,8);g.stroke();g.beginPath();g.arc(cx,86,3,0,7);g.fill();break;
  case'kids':g.arc(cx,52,18,0,7);g.moveTo(cx,70);g.quadraticCurveTo(cx-8,82,cx,94);g.stroke();break;
  case'gifts':g.rect(cx-26,54,52,36);g.moveTo(cx,54);g.lineTo(cx,90);g.moveTo(cx-30,54);g.lineTo(cx+30,54);g.moveTo(cx,54);g.quadraticCurveTo(cx-20,30,cx-14,50);g.moveTo(cx,54);g.quadraticCurveTo(cx+20,30,cx+14,50);g.stroke();break;
  case'furn':g.moveTo(cx-32,84);g.lineTo(cx-32,56);g.lineTo(cx+32,56);g.lineTo(cx+32,84);g.moveTo(cx-24,70);g.lineTo(cx+24,70);g.moveTo(cx-24,56);g.lineTo(cx-24,42);g.lineTo(cx+24,42);g.lineTo(cx+24,56);g.stroke();break;
  case'home':g.moveTo(cx-30,62);g.lineTo(cx,36);g.lineTo(cx+30,62);g.moveTo(cx-22,56);g.lineTo(cx-22,90);g.lineTo(cx+22,90);g.lineTo(cx+22,56);g.stroke();break;
  case'sport':g.arc(cx,64,28,0,7);g.moveTo(cx-28,64);g.lineTo(cx+28,64);g.moveTo(cx,36);g.quadraticCurveTo(cx+18,64,cx,92);g.stroke();break;
  case'wc':g.arc(cx-17,38,7,0,7);g.moveTo(cx-17,50);g.lineTo(cx-17,76);g.moveTo(cx-17,76);g.lineTo(cx-17,94);g.moveTo(cx-28,54);g.lineTo(cx-6,54);g.arc(cx+17,38,7,0,7);g.moveTo(cx+17,50);g.lineTo(cx+8,78);g.lineTo(cx+26,78);g.closePath();g.moveTo(cx,34);g.lineTo(cx,94);g.stroke();break;
  case'serv':g.arc(cx,64,24,0,7);g.moveTo(cx,64);g.lineTo(cx,48);g.moveTo(cx,64);g.lineTo(cx+12,70);g.stroke();break;
  default:g.moveTo(cx-24,48);g.lineTo(cx+24,48);g.lineTo(cx+20,90);g.lineTo(cx-20,90);g.closePath();g.moveTo(cx-10,48);g.arc(cx,48,10,Math.PI,0);g.stroke();}
 });});
pictoUV = cat=>{const k=Math.max(0,PICTO_KEYS.indexOf(cat));return[k/PICTO_KEYS.length+.002,0.01,(k+1)/PICTO_KEYS.length-.002,0.99];};
blobTex = canvasTex(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,2,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.35)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
}
