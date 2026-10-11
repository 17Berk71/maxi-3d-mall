// Запуск: ждём шрифты и выгрузки, собираем сцену, показываем страницу.
import {FONT_LOADS} from '../mall/signs.js';
import {feedIndexReady} from '../shop/feeds.js';
import {PREFS} from './settings.js';
import {updateCross} from '../controls/input.js';
import {updateFloorUI, updateJoy} from '../controls/move.js';
import {applyPose, player, walkPose} from '../controls/player.js';
import {setVis} from '../controls/view.js';
import {$} from './helpers.js';
import {frame} from './loop.js';
import {build} from '../mall/build.js';
import {nearestFree} from '../nav/walkgrid.js';
import {buildFloorMirror} from '../render/floor-mirror.js';
import {FX, coarse, floorMatsF} from '../render/scene.js';
import {applyStyle} from '../render/style-apply.js';
import {setCalm} from '../ui/calm.js';
import {buildChips} from '../ui/filter.js';
import {showHint} from '../ui/hint.js';
import {sizeMini} from '../ui/minimap.js';
import {app} from './state.js';

export async function start(){
 try{await Promise.race([Promise.all(['800 40px Manrope',...FONT_LOADS].map(f=>document.fonts.load(f).catch(()=>{})).concat([feedIndexReady()])),new Promise(r=>setTimeout(r,3000))]);}catch(e){}
 try{build();}catch(err){$('loading').textContent='Не получилось построить сцену: '+err.message;console.error(err);return;}
 {const w=nearestFree(player.x,player.z);if(w){player.x=w[0];player.z=w[1];}}
 const qs=new URLSearchParams(location.search);if(qs.has('calm'))app.calm=qs.get('calm')!=='0';setCalm(app.calm);
 applyStyle(qs.get('style')||'coolG');
 FX.patchFloors(floorMatsF);buildFloorMirror();FX.init();
 if(qs.get('fx')==='0')FX.setTier(0);else if(qs.has('q'))FX.setTier(+qs.get('q'));else if(PREFS.gfx!=='auto')FX.setMode(PREFS.gfx);
 buildChips();updateFloorUI();sizeMini();updateJoy();setVis();updateCross();applyPose(walkPose());
 $('loading').hidden=true;
 showHint(coarse?'Джойстик — идти, палец за краем круга — бежать. Проведи по экрану — осмотреться.':'Ты у входа 2. Кликни по сцене — курсор скроется, и обзор пойдёт за мышью · WASD — идти · Esc — вернуть курсор');
 requestAnimationFrame(frame);
}
