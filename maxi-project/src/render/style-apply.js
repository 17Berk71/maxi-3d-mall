// Пробные стили оформления (?style=...).
import {makeStyler} from './styles.js';
import {blockedF} from '../controls/move.js';
import {S} from '../mall/stores.js';
import {FY, G, MAT, world} from '../mall/world.js';
import {CELL, GH, GRIDS, GW, fromPx} from '../nav/walkgrid.js';
import {MERGED, floorMats, hemi, renderer, scene, skyMesh, sun} from './scene.js';
import {PER, signAtlases} from './sign-atlases.js';
import {app} from '../core/state.js';
export let applyStyle;
let walkPoints;

// по порядку, при запуске
export function init() {

// пробные стили оформления: ?style=warm|game|night
walkPoints = (f,step)=>{const st=Math.round(step/CELL),o=[];for(let j=2;j<GH;j+=st)for(let i=2;i<GW;i+=st){if(!GRIDS[f][j*GW+i])continue;const [x,z]=fromPx(i,j);if(!blockedF(f,x,z))o.push([x,z]);}return o;};
applyStyle = name=>makeStyler({scene,renderer,hemi,sun,sky:skyMesh,S,MAT,floors:floorMats,slabMat:world.slabMat,roofMat:world.roofMat,railMat:world.railMat,colMat:world.colMat,merged:MERGED,signAtlases,PER,walkPoints,FY,G,lockFog:(n,f)=>{app.FOGW=[n,f];}})(name);
}
