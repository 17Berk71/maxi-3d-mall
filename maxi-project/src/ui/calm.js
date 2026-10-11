// Переключатель «Без анимации».
import {$} from '../core/helpers.js';
import {app} from '../core/state.js';

/* ---------- Режим без анимации ---------- */
export function setCalm(v){app.calm=v;document.documentElement.classList.toggle('calm',v);$('calmT').checked=v;try{localStorage.setItem('maxi-calm',v?'1':'0');}catch(e){}
 if(v&&app.anim){app.anim.t=1;}}

// по порядку, при запуске
export function init() {

$('calmT').addEventListener('change',e=>setCalm(e.target.checked));
}
