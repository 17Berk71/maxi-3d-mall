// Настройки в «О проекте»: чувствительность, графика.
import {PREFS, setPref} from '../core/settings.js';
import {goFloor} from '../controls/move.js';
import {setMode} from '../controls/view.js';
import {$} from '../core/helpers.js';
import {FX, coarse} from '../render/scene.js';
let GFX_NOTE;

export function syncSettings(){const r=$('sensR');r.value=PREFS.sens;$('sensV').textContent=PREFS.sens<0.8?'ниже обычного':PREFS.sens>1.25?'выше обычного':'обычная';
 [...$('gfxSeg').children].forEach(b=>{const on=b.dataset.v===PREFS.gfx;b.classList.toggle('on',on);b.setAttribute('aria-checked',on);});$('gfxNote').textContent=GFX_NOTE[PREFS.gfx];}

// по порядку, при запуске
export function init() {

/* ---------- Настройки: чувствительность, графика ---------- */
GFX_NOTE = {auto:coarse?'Качество подбирается само. На телефоне пол без живого отражения — так плавнее':'Качество подбирается само по скорости кадров',best:coarse?'Чётче картинка, свечение ламп. Отражение пола — облегчённое':'Полное отражение пола, сглаживание. Нужна хорошая видеокарта',fast:'Без тяжёлых эффектов — для слабых устройств и ноутбуков от батареи'};
$('sensR').addEventListener('input',e=>{setPref('sens',+e.target.value);syncSettings();});
$('gfxSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;setPref('gfx',b.dataset.v);FX.setMode(PREFS.gfx);syncSettings();});
$('info').addEventListener('pointerdown',e=>{if(e.target.id==='info')$('info').hidden=true;});
$('bWalk').onclick=()=>setMode('walk');$('bTop').onclick=()=>setMode('top');
$('bF1').onclick=()=>goFloor(1);$('bF2').onclick=()=>goFloor(2);
}
