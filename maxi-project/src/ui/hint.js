// Подсказка внизу экрана.
import {$} from '../core/helpers.js';

export function showHint(t){const h=$('hint');h.textContent=t;h.style.opacity=1;clearTimeout(showHint.t);showHint.t=setTimeout(hideHint,9000);}
export function hideHint(){$('hint').style.opacity=0;}
