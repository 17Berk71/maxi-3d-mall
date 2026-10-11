// Атласы вывесок, подписей вида сверху и консольных табличек.
import {signStyle, drawSign, drawBlade} from '../mall/signs.js';
import {CATS} from '../mall/categories.js';
import {S} from '../mall/stores.js';
import {canvasTex, fitFont} from './canvas.js';
export let CW_, CH_, PER, signAtlases, labelAtlases, bladeAtlases;

export function buildAtlases(){
 for(let a=0;a*PER<S.length;a++){
  const list=S.slice(a*PER,(a+1)*PER);
  // вывеска: светящиеся буквы на фризе
  signAtlases.push(canvasTex(2048,2048,(g)=>{list.forEach((s,i)=>{const x=(i%4)*CW_,y=Math.floor(i/4)*CH_;
   if(s.cat!=='tbd'&&s.cat!=='wc'){s.sign=signStyle(s,CATS[s.cat].h);drawSign(g,x,y,CW_,CH_,s,s.sign);s.atlas=a;s.uv=[x/2048+.001,1-(y+CH_)/2048+.002,(x+CW_)/2048-.001,1-y/2048-.002];return;}
   g.fillStyle=s.cat==='tbd'?'#d9d6d0':'#26292d';g.fillRect(x,y,CW_,CH_);
   if(s.cat!=='tbd'){g.fillStyle=CATS[s.cat].c;g.fillRect(x,y+CH_-5,CW_,5);}
   g.textAlign='center';g.textBaseline='middle';fitFont(g,s.name,CW_-40,40,800);
   if(s.cat!=='tbd'){g.shadowColor='rgba(255,250,235,.8)';g.shadowBlur=10;g.fillStyle='#fffaf0';}else{g.fillStyle='#8c96a0';}
   g.fillText(s.name,x+CW_/2,y+CH_/2);g.shadowBlur=0;
   s.atlas=a;s.uv=[x/2048+.001,1-(y+CH_)/2048+.002,(x+CW_)/2048-.001,1-y/2048-.002];});}));
  // консольные таблички поперёк коридора: ячейки 256×128
  bladeAtlases.push(canvasTex(2048,2048,(g)=>{list.forEach((s,i)=>{if(!s.sign)return;const x=(i%8)*256,y=Math.floor(i/8)*128;drawBlade(g,x,y,256,128,s,s.sign);
   s.buv=[x/2048+.002,1-(y+128)/2048+.003,(x+256)/2048-.002,1-y/2048-.003];});}));
  labelAtlases.push(canvasTex(2048,2048,(g)=>{list.forEach((s,i)=>{const x=(i%4)*CW_,y=Math.floor(i/4)*CH_;
   if(s.cat==='tbd')return;
   g.textAlign='center';g.textBaseline='middle';const fs=fitFont(g,s.name,CW_-24,40,800);
   const tw=g.measureText(s.name).width;s.lfs=fs;s.ltw=tw;
   g.lineJoin='round';g.lineWidth=Math.max(3,fs*0.2);g.strokeStyle='rgba(18,26,36,.85)';g.strokeText(s.name,x+CW_/2,y+CH_/2+2);
   g.fillStyle='#ffffff';g.fillText(s.name,x+CW_/2,y+CH_/2+2);});}));
 }
}

// по порядку, при запуске
export function init() {

CW_ = 512; CH_ = 64; PER = 4*32;signAtlases = []; labelAtlases = []; bladeAtlases = [];
}
