// Текстуры из canvas: canvasTex (sRGB), скруглённый прямоугольник, подбор размера шрифта.
import * as THREE from 'three';
import {maxAniso} from './scene.js';

export function canvasTex(w,h,draw,linear){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=Math.min(8,maxAniso);if(!linear)t.encoding=THREE.sRGBEncoding;return t;}
export function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
export function fitFont(g,text,maxW,size,weight){let s=size;do{g.font=`${weight||800} ${s}px Manrope, system-ui, sans-serif`;s-=2;}while(g.measureText(text).width>maxW&&s>10);return s+2;}
