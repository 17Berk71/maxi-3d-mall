// Склейка тысяч квадов и мешей в несколько больших BufferGeometry (Merger), формы, выдавливание.
import * as THREE from 'three';
import {V3} from '../core/helpers.js';

/* ---------- Склейка геометрии ---------- */
export function Merger(){this.p=[];this.n=[];this.u=[];this.c=[];this.f=[];}
export function shapeOf(poly,holes){const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0],-p[1])));(holes||[]).forEach(h=>sh.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(p[0],-p[1])))));return sh;}
export function extrude(shape,y0,h){const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:1});g.rotateX(-Math.PI/2);g.translate(0,y0,0);return g;}
export function flatShape(poly,y){const g=new THREE.ShapeGeometry(shapeOf(poly));g.rotateX(-Math.PI/2);g.translate(0,y,0);return g;}

// по порядку, при запуске
export function init() {

Merger.prototype.add=function(geo,colorFn,sid,mat4){
 let g=geo.index?geo.toNonIndexed():geo;if(mat4)g.applyMatrix4(mat4);if(!g.attributes.normal)g.computeVertexNormals();
 const P=g.attributes.position.array,N=g.attributes.normal.array,U=g.attributes.uv?g.attributes.uv.array:null,cnt=P.length/3;
 for(let i=0;i<P.length;i++){this.p.push(P[i]);this.n.push(N[i]);}
 for(let i=0;i<cnt;i++){if(U)this.u.push(U[i*2],U[i*2+1]);else this.u.push(0,0);if(colorFn){const c=colorFn(N[i*3+1]);this.c.push(c.r,c.g,c.b);}}
 for(let i=0;i<cnt/3;i++)this.f.push(sid==null?-1:sid);
};
// a=низ-лево, b=низ-право, c=верх-право, d=верх-лево (как видит зритель со стороны лицевой грани)
Merger.prototype.quad=function(a,b,c,d,uv,color,sid){
 const e1=new V3().subVectors(b,a),e2=new V3().subVectors(d,a),nn=new V3().crossVectors(e1,e2).normalize();
 const v=[a,b,c,a,c,d],t=[[uv[0],uv[1]],[uv[2],uv[1]],[uv[2],uv[3]],[uv[0],uv[1]],[uv[2],uv[3]],[uv[0],uv[3]]];
 for(let i=0;i<6;i++){this.p.push(v[i].x,v[i].y,v[i].z);this.n.push(nn.x,nn.y,nn.z);this.u.push(t[i][0],t[i][1]);if(color)this.c.push(color.r,color.g,color.b);}
 this.f.push(sid==null?-1:sid,sid==null?-1:sid);
};
// вертикальная панель, обращённая к зрителю, стоящему со стороны нормали n: левый край — центр − R·w/2
Merger.prototype.panel=function(center,n,w,y0,y1,uv,color,sid){const R=new V3(n.z,0,-n.x);
 const L=center.clone().addScaledVector(R,-w/2),Rr=center.clone().addScaledVector(R,w/2);
 this.quad(new V3(L.x,y0,L.z),new V3(Rr.x,y0,Rr.z),new V3(Rr.x,y1,Rr.z),new V3(L.x,y1,L.z),uv||[0,0,1,1],color,sid);};
Merger.prototype.mesh=function(mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2));if(this.c.length)g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));const m=new THREE.Mesh(g,mat);m.userData.fs=this.f;return m;};
}
