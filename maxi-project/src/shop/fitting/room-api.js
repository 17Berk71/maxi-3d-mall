// Что примерочная даёт остальному сайту и проверкам (FIT).
import {PREFS} from '../../core/settings.js';
import {classify, isWearable} from './classify.js';
import {QC} from './qc.js';
import {fitNote, sizeOf} from './sizes.js';
import {ANIM} from './worker.js';
import {mountBodyControls} from './room-body-controls.js';
import {closeRoom, openRoom} from './room-open.js';
import {rebuild} from './room-outfit.js';
import {addPack} from './room-packs.js';
import {render} from './room-panel.js';
import {replay, view} from './room-playback.js';
import {R, built} from './room-scene.js';
import {W, add, has, persist, putOn, subs, worn} from './room-wardrobe.js';
import {fit} from './state.js';

// по порядку, при запуске
export function init() {

  return {
    setView: kind => { if (R) view(kind); }, _avatar: () => R && R.avatar, _R: () => R,   /* для лаборатории: снимок-маска вещи (tools/lab/batch.mjs) */ setAnim: on => { ANIM.on = !!on; }, replay: () => replay(), playing: () => !!(R && R.play), _frame: k => { if (R && R.play) R.play.fixedK = k; return R && R.play ? R.play.nf : 0; }, setRot: r => { if (R) { R.view.rot = r; R.avatar.rotation.y = r; } }, setZoom: (z, hh) => { if (R) { R.view.z = z; if (hh != null) R.view.h = hh; } },
    addPack, wear(ids, states, sizes) { W.worn = []; ids.forEach(id => putOn(id, true)); Object.entries(states || {}).forEach(([id, st]) => { const it = W.items.find(i => i.id === id); if (it) it.state = st; });
      W.items.forEach(it => { if (it.sizesT) it.size = (sizes && sizes[it.id]) || null; }); persist(); render(); },
    qc: id => QC[id] || null,
    ready: () => { rebuild(); return built.chain; },          // для проверок: дождаться, пока образ соберётся
    fitNote: id => { const it = W.items.find(i => i.id === id); return it ? fitNote(it, PREFS.body) + ' | размер ' + ((sizeOf(it, PREFS.body) || {}).name || '-') : ''; },
    setState(id, st) { const it = W.items.find(i => i.id === id); if (it) { it.state = st; persist(); render(); } },
    open: openRoom, close: closeRoom, get isOpen() { return fit.open; },
    add, has, count: () => W.items.length, onChange: f => subs.push(f),
    mountBodyControls, isWearable, classify,
    get items() { return W.items; }, get worn() { return worn(); },
  };

}
