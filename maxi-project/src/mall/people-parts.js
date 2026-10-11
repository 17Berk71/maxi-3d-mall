// Посетители: геометрия частей фигуры (общая для всех людей).
import * as THREE from 'three';
import {Merger} from '../render/merger.js';
let HP;

export function humanParts(){if(HP)return HP;
 const lat=(pts,seg)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg||10);
 const torso=lat([[0,0.86],[0.14,0.88],[0.165,0.98],[0.15,1.1],[0.155,1.26],[0.19,1.4],[0.2,1.46],[0.16,1.52],[0.07,1.56],[0,1.57]]);torso.scale(1,1,0.66);
 const leg=x=>[new THREE.CylinderGeometry(0.07,0.058,0.44,7).translate(x,0.66,0),new THREE.SphereGeometry(0.06,7,5).translate(x,0.44,0),new THREE.CylinderGeometry(0.057,0.045,0.38,7).translate(x,0.25,0)];
 const arm=x=>[new THREE.SphereGeometry(0.055,7,5).translate(x,1.45,0),new THREE.CylinderGeometry(0.05,0.043,0.32,7).translate(x,1.28,0),new THREE.CylinderGeometry(0.042,0.035,0.3,7).translate(x,0.99,0.01)];
 const hands=[-1,1].map(s=>new THREE.SphereGeometry(0.045,7,5).scale(0.8,1.1,0.6).translate(s*0.215,0.8,0.015));
 const head=new THREE.SphereGeometry(0.1,12,9);head.scale(0.92,1.12,1);head.translate(0,1.72,0.005);
 const neck=new THREE.CylinderGeometry(0.045,0.05,0.1,7);neck.translate(0,1.6,0);
 const hair=new THREE.SphereGeometry(0.104,12,7,0,Math.PI*2,0,Math.PI*0.55);hair.scale(0.95,1.1,1.05);hair.translate(0,1.735,-0.01);
 const shoes=[-1,1].map(s=>new THREE.SphereGeometry(0.06,8,5).scale(0.85,0.55,1.7).translate(s*0.09,0.035,0.035));
 const merge=(gs)=>{const m=new Merger();gs.forEach(g=>m.add(g));const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(m.p,3));bg.setAttribute('normal',new THREE.Float32BufferAttribute(m.n,3));return bg;};
 HP={torso:merge([torso]),legs:merge([...leg(-0.09),...leg(0.09)]),arms:merge([...arm(-0.215),...arm(0.215)]),head:merge([head,neck,...hands]),hair:merge([hair]),shoes:merge(shoes)};return HP;}

// по порядку, при запуске
export function init() {

HP = null;
}
