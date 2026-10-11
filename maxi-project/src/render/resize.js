// Размер окна изменился — рендер, камера, мини-карта.
import {cam, renderer} from './scene.js';
import {sizeMini} from '../ui/minimap.js';

// по порядку, при запуске
export function init() {

addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();sizeMini();});
}
