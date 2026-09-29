// Картинки товаров для карточек каталога (рисуются на canvas, без фото)
import {shade} from '../utils.js';

/* ---------- 2D-иконки товаров для карточек ---------- */
const iconCache={};
export function iconURL(type,color){const key=type+color;if(iconCache[key])return iconCache[key];
 const c=document.createElement('canvas');c.width=240;c.height=180;const g=c.getContext('2d');
 const bg=g.createLinearGradient(0,0,0,180);bg.addColorStop(0,'#f5f3ef');bg.addColorStop(1,'#e4e0d8');g.fillStyle=bg;g.fillRect(0,0,240,180);
 g.fillStyle='rgba(0,0,0,.08)';g.beginPath();g.ellipse(120,158,70,10,0,0,7);g.fill();
 const col=color,dk=shade(color,-.3),lt=shade(color,.35);g.lineJoin='round';g.lineCap='round';
 const P=(pts,fill)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fillStyle=fill;g.fill();};
 switch(type){
  case'shoe':P([[40,120],[60,80],[95,78],[120,95],[190,108],[205,125],[200,140],[40,140]],col);g.fillStyle='#f4f4f2';g.fillRect(38,132,168,12);g.strokeStyle=lt;g.lineWidth=3;for(let i=0;i<4;i++){g.beginPath();g.moveTo(80+i*9,86+i*3);g.lineTo(96+i*9,92+i*3);g.stroke();}break;
  case'jacket':P([[80,40],[160,40],[195,70],[185,150],[160,150],[160,80],[155,150],[85,150],[80,80],[80,150],[55,150],[45,70]],col);g.strokeStyle=dk;g.lineWidth=3;g.beginPath();g.moveTo(120,45);g.lineTo(120,150);g.stroke();for(let y=60;y<150;y+=20){g.beginPath();g.moveTo(84,y);g.lineTo(156,y);g.strokeStyle='rgba(0,0,0,.12)';g.stroke();}break;
  case'pants':P([[85,30],[155,30],[165,150],[132,150],[120,70],[108,150],[75,150]],col);g.fillStyle=dk;g.fillRect(85,30,70,10);break;
  case'tshirt':P([[85,40],[105,34],[120,45],[135,34],[155,40],[190,65],[172,85],[158,75],[158,150],[82,150],[82,75],[68,85],[50,65]],col);break;
  case'dress':P([[100,30],[140,30],[145,70],[175,150],[65,150],[95,70]],col);g.fillStyle=dk;g.fillRect(95,68,50,6);break;
  case'football':g.fillStyle='#fff';g.beginPath();g.arc(120,90,55,0,7);g.fill();g.fillStyle='#222';for(const[a,b]of[[120,90],[90,65],[150,65],[80,110],[160,110],[120,140]]){g.beginPath();for(let k=0;k<5;k++){const an=k/5*Math.PI*2-Math.PI/2;g.lineTo(a+Math.cos(an)*12,b+Math.sin(an)*12);}g.fill();}g.strokeStyle='rgba(0,0,0,.2)';g.lineWidth=2;g.beginPath();g.arc(120,90,55,0,7);g.stroke();break;
  case'basketball':g.fillStyle='#e0782c';g.beginPath();g.arc(120,90,55,0,7);g.fill();g.strokeStyle='#3a1f10';g.lineWidth=3;g.beginPath();g.arc(120,90,55,0,7);g.moveTo(65,90);g.lineTo(175,90);g.moveTo(120,35);g.lineTo(120,145);g.stroke();g.beginPath();g.arc(70,90,40,-1,1);g.stroke();g.beginPath();g.arc(170,90,40,Math.PI-1,Math.PI+1);g.stroke();break;
  case'bike':g.strokeStyle='#222';g.lineWidth=7;g.beginPath();g.arc(70,115,32,0,7);g.stroke();g.beginPath();g.arc(170,115,32,0,7);g.stroke();g.strokeStyle=col;g.lineWidth=7;g.beginPath();g.moveTo(70,115);g.lineTo(105,70);g.lineTo(150,70);g.lineTo(170,115);g.moveTo(105,70);g.lineTo(120,115);g.lineTo(150,70);g.moveTo(70,115);g.lineTo(120,115);g.stroke();g.strokeStyle='#222';g.lineWidth=5;g.beginPath();g.moveTo(100,62);g.lineTo(115,62);g.moveTo(150,70);g.lineTo(145,55);g.lineTo(160,52);g.stroke();break;
  case'dumbbell':g.fillStyle='#555';g.fillRect(70,84,100,12);g.fillStyle=col;g.fillRect(50,60,24,60);g.fillRect(166,60,24,60);g.fillStyle=dk;g.fillRect(40,68,12,44);g.fillRect(188,68,12,44);break;
  case'perfume':g.fillStyle=lt;g.fillRect(85,70,70,75);g.fillStyle='rgba(255,255,255,.4)';g.fillRect(92,76,12,60);g.fillStyle=dk;g.fillRect(105,45,30,25);g.fillStyle='#caa24a';g.fillRect(110,62,20,8);break;
  case'lipstick':g.fillStyle=dk;g.fillRect(100,95,40,55);g.fillStyle='#caa24a';g.fillRect(104,80,32,16);P([[106,80],[134,80],[134,50],[106,62]],col);break;
  case'jar':g.fillStyle=lt;g.fillRect(80,75,80,70);g.fillStyle=col;g.fillRect(76,60,88,20);g.fillStyle='#fff';g.fillRect(95,100,50,24);break;
  case'ring':g.strokeStyle='#d4af37';g.lineWidth=10;g.beginPath();g.ellipse(120,105,40,34,0,0,7);g.stroke();g.fillStyle=lt;g.beginPath();g.moveTo(120,50);g.lineTo(138,68);g.lineTo(120,78);g.lineTo(102,68);g.closePath();g.fill();break;
  case'watch':g.fillStyle=dk;g.fillRect(105,25,30,130);g.fillStyle='#c9ccd0';g.beginPath();g.arc(120,90,34,0,7);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(120,90,27,0,7);g.fill();g.strokeStyle='#222';g.lineWidth=3;g.beginPath();g.moveTo(120,90);g.lineTo(120,72);g.moveTo(120,90);g.lineTo(134,96);g.stroke();break;
  case'glasses':g.strokeStyle=dk;g.lineWidth=6;g.fillStyle='rgba(80,120,160,.35)';g.beginPath();g.ellipse(88,95,30,22,0,0,7);g.fill();g.stroke();g.beginPath();g.ellipse(152,95,30,22,0,0,7);g.fill();g.stroke();g.beginPath();g.moveTo(118,92);g.lineTo(122,92);g.moveTo(58,90);g.lineTo(40,80);g.moveTo(182,90);g.lineTo(200,80);g.stroke();break;
  case'phone':g.fillStyle='#1b1d20';g.fillRect(90,25,60,130);g.fillStyle=col;g.fillRect(95,33,50,112);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(95,33,18,112);break;
  case'headphones':g.strokeStyle=dk;g.lineWidth=10;g.beginPath();g.arc(120,95,50,Math.PI,0);g.stroke();g.fillStyle=col;g.fillRect(62,92,24,46);g.fillRect(154,92,24,46);break;
  case'fridge':g.fillStyle='#e9ebee';g.fillRect(80,20,80,140);g.strokeStyle='#b8bcc2';g.lineWidth=3;g.strokeRect(80,20,80,140);g.beginPath();g.moveTo(80,70);g.lineTo(160,70);g.stroke();g.fillStyle='#9aa0a6';g.fillRect(148,35,5,22);g.fillRect(148,85,5,30);break;
  case'sofa':g.fillStyle=dk;g.fillRect(40,70,160,40);g.fillStyle=col;g.fillRect(40,100,160,35);g.fillRect(30,85,22,55);g.fillRect(188,85,22,55);g.fillStyle='#333';g.fillRect(45,138,8,12);g.fillRect(187,138,8,12);break;
  case'bed':g.fillStyle=dk;g.fillRect(40,60,20,90);g.fillStyle='#f4f1ea';g.fillRect(55,100,150,30);g.fillStyle=col;g.fillRect(90,95,115,38);g.fillStyle='#fff';g.fillRect(60,90,30,14);break;
  case'pot':g.fillStyle=col;g.fillRect(70,75,100,65);g.fillStyle=dk;g.fillRect(64,68,112,12);g.fillRect(110,58,20,10);g.fillRect(52,90,18,8);g.fillRect(170,90,18,8);break;
  case'toy':g.fillStyle=col;g.beginPath();g.arc(120,110,38,0,7);g.fill();g.beginPath();g.arc(120,62,26,0,7);g.fill();g.beginPath();g.arc(100,42,10,0,7);g.arc(140,42,10,0,7);g.fill();g.fillStyle='#222';g.beginPath();g.arc(112,60,3,0,7);g.arc(128,60,3,0,7);g.fill();break;
  case'candy':g.fillStyle=col;g.beginPath();g.ellipse(120,90,40,26,0,0,7);g.fill();P([[80,90],[55,70],[55,110]],lt);P([[160,90],[185,70],[185,110]],lt);break;
  case'cup':g.fillStyle='#fff';g.fillRect(85,70,60,70);g.strokeStyle='#fff';g.lineWidth=8;g.beginPath();g.arc(150,100,16,-1.4,1.4);g.stroke();g.fillStyle='#6b3f22';g.fillRect(88,72,54,10);g.fillStyle='#ddd';g.fillRect(70,140,100,6);break;
  case'plate':g.fillStyle='#fff';g.beginPath();g.ellipse(120,105,70,30,0,0,7);g.fill();g.fillStyle=col;g.beginPath();g.ellipse(120,98,40,16,0,0,7);g.fill();break;
  case'bag':P([[70,70],[170,70],[180,150],[60,150]],col);g.strokeStyle=dk;g.lineWidth=6;g.beginPath();g.arc(120,70,26,Math.PI,0);g.stroke();break;
  case'bone':g.fillStyle=col;g.fillRect(80,82,80,16);[[80,82],[80,98],[160,82],[160,98]].forEach(([x,y])=>{g.beginPath();g.arc(x,y,12,0,7);g.fill();});break;
  case'gift':g.fillStyle=col;g.fillRect(70,70,100,75);g.fillStyle=lt;g.fillRect(112,70,16,75);g.fillRect(70,98,100,14);g.fillStyle=dk;g.beginPath();g.ellipse(106,62,16,9,0.4,0,7);g.ellipse(134,62,16,9,-0.4,0,7);g.fill();break;
  default:g.fillStyle=col;g.fillRect(75,55,90,90);g.fillStyle=lt;g.fillRect(75,55,90,16);g.fillStyle='rgba(255,255,255,.6)';g.fillRect(90,95,60,20);}
 return iconCache[key]=c.toDataURL('image/png');}

