// Ползунки фигуры (и в примерочной, и в настройках сайта).
import {PREFS, setPref, onPref, BODY0} from '../../core/settings.js';
import {h, render} from './room-panel.js';
import {SKIN} from './room-scene.js';
import {fit} from './state.js';
let SL, boxes;

  export function renderBodyControls(box) {
    const b = PREFS.body, wrap = h('div', 'fit-body');
    const sx_ = h('div', 'seg3'); [['f', 'Женская'], ['m', 'Мужская']].forEach(([v, t]) => { const bt = h('button', b.sex === v ? 'on' : '', t); bt.onclick = () => { const dflt = v === 'm' ? {sex: 'm', height: 180, weight: 78, chest: 98, waist: 84, hips: 100} : {sex: 'f', height: 168, weight: 60, chest: 90, waist: 72, hips: 98}; setPref('body', dflt); }; sx_.appendChild(bt); });
    wrap.appendChild(h('div', 'sh-lab', 'Фигура')); wrap.appendChild(sx_);
    SL.forEach(([k, t, mn, mx, st, u]) => {
      const row = h('label', 'fit-sl'); const top = h('span'); top.appendChild(h('b', '', t)); const val = h('small', '', k === 'build' ? (b[k] < 0.33 ? 'худощавое' : b[k] > 0.66 ? 'плотное' : 'среднее') : b[k] + ' ' + u); top.appendChild(val); row.appendChild(top);
      const r = h('input'); r.type = 'range'; r.min = mn; r.max = mx; r.step = st; r.value = b[k];
      r.oninput = () => { const v = +r.value; val.textContent = k === 'build' ? (v < 0.33 ? 'худощавое' : v > 0.66 ? 'плотное' : 'среднее') : v + ' ' + u; setPref('body', {[k]: v}); };
      row.appendChild(r); wrap.appendChild(row);
    });
    wrap.appendChild(h('div', 'sh-lab', 'Тон фигуры'));
    const tone = h('div', 'fit-tones'); SKIN.forEach((c, i) => { const bt = h('button', (b.skin | 0) === i ? 'on' : ''); bt.style.background = c; bt.setAttribute('aria-label', i ? 'Тон ' + i : 'Как манекен'); bt.title = i ? 'Тон ' + i : 'Как манекен'; bt.onclick = () => setPref('body', {skin: i}); tone.appendChild(bt); }); wrap.appendChild(tone);
    const rs = h('button', 'btn', 'Сбросить'); rs.onclick = () => setPref('body', {...BODY0}); wrap.appendChild(rs);
    box.appendChild(wrap);
    return wrap;
  }
  export function mountBodyControls(box) { boxes.push(box); box.innerHTML = ''; renderBodyControls(box); }

// по порядку, при запуске
export function init() {

  // ползунки фигуры: и в примерочной, и в «О проекте» → «Настройки»
  SL = [['height', 'Рост', 140, 205, 1, 'см'], ['weight', 'Вес', 40, 150, 1, 'кг'], ['chest', 'Обхват груди', 70, 135, 1, 'см'], ['waist', 'Обхват талии', 55, 130, 1, 'см'], ['hips', 'Обхват бёдер', 75, 140, 1, 'см']];
  // перерисовать ползунки, если параметры поменяли в другом месте
  boxes = [];
  onPref(k => { if (k !== 'body') return; boxes.forEach(b => { if (!b.contains(document.activeElement) || document.activeElement.type !== 'range') { b.innerHTML = ''; renderBodyControls(b); } }); if (fit.open && fit.tab === 'body' && !(document.activeElement && document.activeElement.type === 'range')) render(); });
}
