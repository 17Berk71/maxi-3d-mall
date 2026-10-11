// Свет и декор зала по стилю интерьера, разметка пола.
import * as THREE from 'three';
import {mulberry, shade} from '../core/utils.js';
import {LIN, V3} from '../core/helpers.js';
import {mtx} from '../mall/world.js';
import {canvasTex} from '../render/canvas.js';
import {B, Cy, CyX, mergeG} from './goods.js';
import {noise, shopBlockedRaw} from './hall-people.js';
import {app} from '../core/state.js';
let poolTex;

export function shopDecorLights(sc,ST,W,D,H){const pts=[],q=new THREE.Quaternion(),one=new V3(1,1,1),Y=new V3(0,1,0);
 const IM=(geo,mat,arr)=>{const m=new THREE.InstancedMesh(geo,mat,Math.max(1,arr.length));arr.forEach((p,i)=>{q.setFromAxisAngle(Y,p[3]||0);mtx.compose(new V3(p[0],p[1],p[2]),q,one);m.setMatrixAt(i,mtx);});m.count=arr.length;sc.add(m);return m;};
 const glow=(r,g,b)=>new THREE.MeshBasicMaterial({color:new THREE.Color(r,g,b),toneMapped:false});
 const dark=new THREE.MeshStandardMaterial({color:LIN('#17181a'),roughness:.4,metalness:.6});
 if(ST.lights==='track'){const rails=[],heads=[];for(let z=-D/2+3;z<D/2-2;z+=3.6){rails.push([0,H-0.03,z]);for(let x=-W/2+2;x<W/2-1.5;x+=1.7){heads.push([x,H-0.03,z]);pts.push([x,z+((x*7|0)%2?0.6:-0.6)]);}}
  IM(B(W-2,0.04,0.06,0,0,0),dark,rails);IM(mergeG([Cy(0.004,0.004,0.12,0,-0.06,0,4),Cy(0.055,0.05,0.18,0,-0.2,0,12)]),dark,heads);IM(new THREE.CircleGeometry(0.045,12).rotateX(Math.PI/2).translate(0,-0.291,0),glow(2.2,2.15,2.0),heads);}
 else if(ST.lights==='globe'){const a=[];for(let x=-W/2+2.5;x<W/2-1.5;x+=4)for(let z=-D/2+2.5;z<D/2-2;z+=3.8){a.push([x,H,z]);pts.push([x,z]);}
  IM(Cy(0.006,0.006,1.6,0,-0.8,0,4),dark,a);IM(new THREE.SphereGeometry(0.24,20,14).translate(0,-1.82,0),glow(1.55,1.38,1.12),a);}
 else if(ST.lights==='pendant'){const a=[];for(let x=-W/2+2.5;x<W/2-1.5;x+=3.6)for(let z=-D/2+2.5;z<D/2-2;z+=3.6){a.push([x,H,z]);pts.push([x,z]);}
  IM(Cy(0.007,0.007,2.0,0,-1.0,0,4),dark,a);IM(new THREE.ConeGeometry(0.34,0.32,20,1,true).translate(0,-2.16,0),new THREE.MeshStandardMaterial({color:LIN('#1c1d1f'),roughness:.35,metalness:.7,side:THREE.DoubleSide}),a);
  IM(new THREE.SphereGeometry(0.075,12,8).translate(0,-2.3,0),glow(2.6,1.9,1.1),a);IM(new THREE.CircleGeometry(0.32,20).rotateX(Math.PI/2).translate(0,-2.3,0),glow(0.9,0.62,0.35),a);}
 else if(ST.lights==='downlight'){const a=[];for(let x=-W/2+2;x<W/2-1;x+=3)for(let z=-D/2+2;z<D/2-1.5;z+=3){a.push([x,H-0.012,z]);pts.push([x,z]);}
  IM(new THREE.RingGeometry(0.12,0.16,20).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:LIN('#b8925a'),roughness:.25,metalness:1}),a);IM(new THREE.CircleGeometry(0.12,20).rotateX(Math.PI/2),glow(2.0,1.85,1.6),a);}
 if(ST.pools&&pts.length){if(!poolTex)poolTex=canvasTex(128,128,(g,w,h)=>{const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,240,215,1)');gr.addColorStop(.5,'rgba(255,240,215,.35)');gr.addColorStop(1,'rgba(255,240,215,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
  const pm=new THREE.MeshBasicMaterial({map:poolTex,transparent:true,opacity:ST.pools,blending:THREE.AdditiveBlending,depthWrite:false});
  IM(new THREE.PlaneGeometry(3.2,3.2).rotateX(-Math.PI/2),pm,pts.map(p=>[p[0],0.015,p[1]]));}}
// декор зала по стилю: растения, ковёр, пуф, скамья, вентиляция, подсветка по периметру
export function shopDecor(sc,ST,W,D,H,colliders,DWs,s){const r=mulberry(s.id+9),ex=ST.extras||[];
 const freeR=(x,z,rad)=>{for(let a=0;a<8;a++){if(shopBlockedRaw(colliders,W,D,x+Math.cos(a*0.785)*rad,z+Math.sin(a*0.785)*rad,0))return false;}return!shopBlockedRaw(colliders,W,D,x,z,0);};
 const nearDoor=(x,z)=>Math.abs(x)<DWs/2+1.5&&z>D/2-3;
 // растения у стен
 if(ST.plants){const potC={gallery:'#e8e6e1',wood:'#b5754e',loft:'#2a2a2a',boutique:'#b8925a'}[ST.key]||'#ddd';const cand=[];
  for(let x=-W/2+0.9;x<=W/2-0.9;x+=1.1){cand.push([x,-D/2+0.9],[x,D/2-0.9]);}for(let z=-D/2+0.9;z<=D/2-0.9;z+=1.1){cand.push([-W/2+0.9,z],[W/2-0.9,z]);}
  for(let i=cand.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[cand[i],cand[j]]=[cand[j],cand[i]];}
  const pl=[];for(const [x,z] of cand){if(pl.length>=ST.plants)break;if(nearDoor(x,z)||!freeR(x,z,0.5)||pl.some(p=>Math.hypot(p[0]-x,p[1]-z)<5))continue;pl.push([x,z]);colliders.push([x-0.35,x+0.35,z-0.35,z+0.35]);}
  const pot=new THREE.MeshStandardMaterial({color:LIN(potC),roughness:ST.key==='boutique'?.3:.7,metalness:ST.key==='boutique'?.8:0}),leaf=new THREE.MeshStandardMaterial({color:LIN('#4c7a43'),roughness:.8,flatShading:true}),stem=new THREE.MeshStandardMaterial({color:LIN('#5a4632')});
  pl.forEach(([x,z],i)=>{const g=new THREE.Group();g.add(new THREE.Mesh(Cy(0.3,0.24,0.55,0,0.275,0,18),pot));g.add(new THREE.Mesh(Cy(0.03,0.04,1.3,0,1.1,0,6),stem));
   for(let k=0;k<7;k++){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(0.32+r()*0.18,0),leaf);m.position.set((r()-.5)*0.7,1.25+r()*0.9,(r()-.5)*0.7);m.rotation.set(r()*3,r()*3,0);g.add(m);}
   g.position.set(x,0,z);sc.add(g);});}
 // свободное место ближе к входу для ковра/пуфа/скамьи
 const spot=rad=>{let best=null;for(let z=D/2-3.2;z>-D/2+2;z-=0.5)for(let x=0;x<W/2-1;x+=0.5)for(const sx of [1,-1]){const X=x*sx;if(freeR(X,z,rad)){best=[X,z];return best;}}return best;};
 if(ex.includes('ottoman')){const p=spot(1.7);if(p){const rug=new THREE.Mesh(new THREE.CircleGeometry(1.6,40).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:LIN('#cdbb9d'),roughness:1}));rug.position.set(p[0],0.02,p[1]);sc.add(rug);
  const ot=new THREE.Mesh(Cy(0.75,0.75,0.42,0,0.21,0,32),new THREE.MeshStandardMaterial({color:LIN(ST.wallTone||'#2f4a3e'),roughness:.9}));ot.position.set(p[0],0,p[1]);sc.add(ot);
  const tp=new THREE.Mesh(Cy(0.73,0.7,0.05,0,0.44,0,32),new THREE.MeshStandardMaterial({color:LIN(shade(ST.wallTone||'#2f4a3e',.12)),roughness:.95}));tp.position.copy(ot.position);sc.add(tp);
  const bb=new THREE.Mesh(Cy(0.78,0.78,0.04,0,0.02,0,32),new THREE.MeshStandardMaterial({color:LIN('#b8925a'),roughness:.25,metalness:1}));bb.position.copy(ot.position);sc.add(bb);colliders.push([p[0]-0.8,p[0]+0.8,p[1]-0.8,p[1]+0.8]);}}
 else if(ex.includes('rug')){const p=spot(1.4);if(p){const rt=canvasTex(512,320,(g,w,h)=>{g.fillStyle='#e3d6c0';g.fillRect(0,0,w,h);g.strokeStyle='#b99c74';g.lineWidth=10;g.strokeRect(24,24,w-48,h-48);g.lineWidth=3;g.strokeRect(46,46,w-92,h-92);noise(g,w,h,mulberry(3),9000,.12);});
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:rt,roughness:1}));rug.position.set(p[0],0.02,p[1]);sc.add(rug);}}
 if(ex.includes('bench')){const p=spot(1.3);if(p){const m=new THREE.MeshStandardMaterial({color:LIN('#c9a477'),roughness:.55});const g=new THREE.Group();g.add(new THREE.Mesh(B(1.8,0.08,0.5,0,0.44,0),m));[-0.75,0.75].forEach(x=>g.add(new THREE.Mesh(B(0.08,0.4,0.46,x,0.2,0),new THREE.MeshStandardMaterial({color:LIN('#1d1f22'),roughness:.4,metalness:.6}))));g.position.set(p[0],0,p[1]);sc.add(g);colliders.push([p[0]-0.95,p[0]+0.95,p[1]-0.3,p[1]+0.3]);}}
 if(ex.includes('ducts')){const m=new THREE.MeshStandardMaterial({color:LIN('#8d9196'),roughness:.45,metalness:.8});[-D/4,D/4].forEach(z=>{const d=new THREE.Mesh(CyX(0.32,W-0.1,0,H-0.7,z,20),m);sc.add(d);
   for(let x=-W/2+2;x<W/2;x+=3){const h=new THREE.Mesh(Cy(0.012,0.012,0.4,x,H-0.2,z,4),m);sc.add(h);const band=new THREE.Mesh(CyX(0.335,0.06,x,H-0.7,z,20),m);sc.add(band);}});
  const pipe=new THREE.MeshStandardMaterial({color:LIN('#3a3c3f'),roughness:.5,metalness:.6});[0.6,1.0].forEach(o=>sc.add(new THREE.Mesh(CyX(0.05,W-0.1,0,H-0.3,-D/2+o,8),pipe)));}
 if(ex.includes('cove')){const m=new THREE.MeshBasicMaterial({color:new THREE.Color(1.7,1.45,1.1),toneMapped:false,side:THREE.DoubleSide});
  [[0,-D/2+0.03,W,0],[-W/2+0.03,0,D,Math.PI/2],[W/2-0.03,0,D,-Math.PI/2]].forEach(([x,z,l,ry])=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(l,0.07),m);p.position.set(x,H-0.32,z);p.rotation.y=ry;sc.add(p);});}
 if(ST.strip==='brass'||ST.strip==='wood'){const m=ST.strip==='brass'?new THREE.MeshStandardMaterial({color:LIN('#b8925a'),roughness:.25,metalness:1}):new THREE.MeshStandardMaterial({color:LIN('#a87c50'),roughness:.6});
  [[0,-D/2+0.04,W,0],[-W/2+0.04,0,D,Math.PI/2],[W/2-0.04,0,D,-Math.PI/2]].forEach(([x,z,l,ry])=>{const p=new THREE.Mesh(B(l,ST.strip==='brass'?0.05:0.14,0.04,0,0,0),m);p.position.set(x,ST.strip==='brass'?H-0.5:0.07,z);p.rotation.y=ry;sc.add(p);});}}
// разметка пола: дорожки между отделами (от входа вглубь и поперёк) и светлые площадки отделов; одна текстура поверх пола
export function shopFloorPlan(sc,P,W,D,zones,L,s){const px=Math.min(48,2048/W),cw=Math.round(W*px),ch=Math.round(D*px);const X=x=>(x+W/2)*px,Z=z=>(z+D/2)*px;
 const aisles=[],hw=P.aisleW/2;
 for(let c=1;c<L.cols;c++){const x=L.x0+c*L.zw;aisles.push([x-hw,L.z0+0.3,x+hw,L.z1]);}
 for(let r=1;r<L.rows;r++){const z=L.z0+r*L.zd;aisles.push([L.x0+0.3,z-hw,L.x1-0.3,z+hw]);}
 const zf=L.z1+0.9;aisles.push([L.x0+0.3,zf-hw,L.x1-0.3,zf+hw]);// поперёк перед отделами
 aisles.push([-Math.max(hw,L.dw/2-0.2),zf,Math.max(hw,L.dw/2-0.2),D/2-1.5]);// от входа
 if(L.cols%2)aisles.push([-hw,L.z0+0.3,hw,L.z1]);// по центру, если отделы не делятся пополам
 const tex=canvasTex(cw,ch,(g)=>{const r=mulberry(s.id+21);const e=Math.max(2,0.05*px);
  const rect=(a,grow)=>g.fillRect(X(a[0])-grow,Z(a[1])-grow,(a[2]-a[0])*px+grow*2,(a[3]-a[1])*px+grow*2);
  // площадки отделов
  zones.forEach(z=>{const a=[z.cx-z.w/2+0.15,z.cz-z.d/2+0.15,z.cx+z.w/2-0.15,z.cz+z.d/2-0.15];g.fillStyle=P.edge;rect(a,e);g.fillStyle=P.zone;rect(a,0);
   g.strokeStyle='rgba(120,100,70,.18)';g.lineWidth=1;g.strokeRect(X(a[0])+0.35*px,Z(a[1])+0.35*px,(a[2]-a[0]-0.7)*px,(a[3]-a[1]-0.7)*px);});
  for(let i=0;i<9000;i++){g.fillStyle=`rgba(90,70,40,${r()*.06})`;g.fillRect(r()*cw,r()*ch,2,2);}
  // дорожки: сначала кромка, потом камень — кромка остаётся только по внешнему контуру
  g.fillStyle=P.edge;aisles.forEach(a=>rect(a,e));g.fillStyle=P.aisle;aisles.forEach(a=>rect(a,0));
  g.save();g.beginPath();aisles.forEach(a=>g.rect(X(a[0]),Z(a[1]),(a[2]-a[0])*px,(a[3]-a[1])*px));g.clip();
  for(let i=0;i<60;i++){let x=r()*cw,y=r()*ch;g.strokeStyle=`rgba(${P.vein},${.08+r()*.12})`;g.lineWidth=0.6+r()*1.4;g.beginPath();g.moveTo(x,y);for(let k=0;k<8;k++){x+=(r()-.5)*90;y+=(r()-.5)*90;g.lineTo(x,y);}g.stroke();}
  for(let i=0;i<6000;i++){g.fillStyle=`rgba(255,255,255,${r()*.05})`;g.fillRect(r()*cw,r()*ch,1.5,1.5);}
  // швы плит на дорожках
  g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=1;for(let x=0;x<W;x+=1.2){g.beginPath();g.moveTo(X(x-W/2),0);g.lineTo(X(x-W/2),ch);g.stroke();}for(let z=0;z<D;z+=1.2){g.beginPath();g.moveTo(0,Z(z-D/2));g.lineTo(cw,Z(z-D/2));g.stroke();}
  g.restore();});
 const m=new THREE.Mesh(new THREE.PlaneGeometry(W,D).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:tex,transparent:true,roughness:.42,envMapIntensity:.18,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
 m.position.y=0.004;m.renderOrder=-1;sc.add(m);}

// по порядку, при запуске
export function init() {

app.SHOP_PEOPLE = null;
// светильники зала по стилю; возвращает точки под светом (для световых пятен)
poolTex = null;
}
