// Сборка образа: по очереди, в фоне, «Надеваю…»; манекен, вещи, анимация надевания.
import * as THREE from 'three';
import {PREFS} from '../../core/settings.js';
import {bodyDims} from './body.js';
import {DRAPE_ON} from './collider.js';
import {LIN} from './common.js';
import {TEX} from './fabric-simple.js';
import {garmentMeshAsync} from './garment-async.js';
import {buildBody} from './mannequin.js';
import {paintBody} from './paint-body.js';
import {PTEX} from './photo-texture.js';
import {commitLayer} from './simple-garment.js';
import {armSpread} from './specs.js';
import {ANIM, CLOTH_VER, calmNow} from './worker.js';
import {fit} from './state.js';
import {loadPack} from './room-packs.js';
import {render} from './room-panel.js';
import {qcLine} from './room-playback.js';
import {R, SKIN, built, el} from './room-scene.js';
import {worn} from './room-wardrobe.js';
let disposeObj;

  function setBusy(on) {
    let e = el('fitBusy'); const c = el('fitC');
    if (!e && on && c && c.parentNode) { e = document.createElement('div'); e.id = 'fitBusy'; e.textContent = 'Надеваю…';
      e.style.cssText = 'position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:6px 14px;border-radius:999px;background:rgba(20,18,16,.72);color:#fff;font:600 13px/1.3 system-ui,sans-serif;pointer-events:none;z-index:5';
      if (getComputedStyle(c.parentNode).position === 'static') c.parentNode.style.position = 'relative'; c.parentNode.appendChild(e); }
    if (e) e.hidden = !on;
  }
  export function rebuild() {
    if (!R) return; const b = PREFS.body, wn = worn(), key = JSON.stringify(b) + '|' + wn.map(i => i.id + ':' + (i.state || '') + ':' + (i.size || '')).join(',');
    if (key === built.key) return; built.key = key; const tok = ++built.tok;
    built.chain = built.chain.then(() => buildOutfit(tok, b, wn)).catch(e => console.error(e));
  }
  async function buildOutfit(tok, b, wn) {
    const alive = () => tok === built.tok && R;
    if (!alive()) return;
    // у вещей из выгрузки сначала скачать пакеты примерки; после этого меняются состояние и размеры — образ соберётся заново со следующего кадра
    if (wn.some(i => i.pack && !i.tex)) { await Promise.all(wn.map(loadPack)); if (alive()) { built.key = ''; render(); } return; }
    // широкая вещь отводит руки: они лежат на ткани, а не проходят сквозь неё
    const d0 = bodyDims(b); d0.armA = armSpread(wn, d0);
    const body = buildBody(b, R.skinMat, d0), next = new THREE.Group(); body.g.traverse(o => { if (o.isMesh) { o.castShadow = true; } }); next.add(body.g);
    const order = {shoes: 0, bottom: 1, dress: 2, top: 3, outer: 4}, bodyKey = JSON.stringify(b) + '|' + d0.armA.toFixed(3);
    const busy = setTimeout(() => { if (alive()) setBusy(true); }, 120);
    // анимация надевания: вещь ложится на тело, манекен чуть поворачивается и отводит руки (не в режиме «без анимации»)
    const anim = ANIM.on && !calmNow(), fresh = built.fresh; built.fresh = false;
    fit.UNDER = []; fit.UNDERZ = []; fit.BOT_YW = 0; let below = '', ok = true;
    try {
      for (const it of wn.slice().sort((a, c) => order[a.slot] - order[c.slot])) {
        const me = it.id + ':' + (it.state || '') + ':' + (it.size || '');
        const g = await garmentMeshAsync(it, body.d, DRAPE_ON && it.tex ? CLOTH_VER + '|' + bodyKey + '|' + below + '|' + me : null, alive, {anim, fresh});
        if (!alive() || !g) { ok = false; if (g) disposeObj(g); break; }
        next.add(g); commitLayer(); below += me + ',';
      }
    } finally { fit.UNDER = fit.UNDERZ = null; fit.PEND = []; fit.PENDZ = []; clearTimeout(busy); }
    if (!ok || !alive()) { disposeObj(next); return; }
    setBusy(false);
    R.skinMat.color.copy(LIN(SKIN[b.skin | 0] || SKIN[0])); R.skinMat.roughness = 0.55;
    paintBody(body.g, next.children.map(o => o.userData && o.userData.cover).filter(Boolean), R.skinMat.color);
    R.avatar.children.slice().forEach(o => { R.avatar.remove(o); disposeObj(o); });
    const rig = new THREE.Group(); next.children.slice().forEach(o => rig.add(o)); R.avatar.add(rig); R.rig = rig; R.d = body.d; R.play = null;
    const list = rig.children.filter(o => o.userData && o.userData.anim && o.userData.cloth);
    if (list.length) { const pivots = []; body.g.traverse(o => { if (o.userData.armPivot) pivots.push(o); });
      const saved = list.map(g => g.children.filter(m => m.userData.cm).map(m => ['position', 'normal', 'color', 'wrk'].map(a => m.geometry.attributes[a] ? m.geometry.attributes[a].array.slice() : null)));
      R.play = {t0: performance.now(), list, saved, pivots, nf: Math.min(...list.map(g => g.userData.anim.nf)), k: -1}; }
    document.querySelectorAll('[data-qc]').forEach(qcLine);
  }

// по порядку, при запуске
export function init() {

  // сборка образа: тело сразу, вещи по очереди (снизу вверх — каждая ложится на предыдущие); ткань считается в фоне.
  // Пока считается, виден прежний образ и надпись «Надеваю…»; новая сборка ждёт окончания прежней (слои — общие)
  disposeObj = o => o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material && m.material !== R.skinMat) { if (m.material.map && !Object.values(TEX).includes(m.material.map) && !Object.values(PTEX).includes(m.material.map)) m.material.map.dispose(); m.material.dispose(); } });
  built.chain = Promise.resolve(); built.tok = 0;
}
