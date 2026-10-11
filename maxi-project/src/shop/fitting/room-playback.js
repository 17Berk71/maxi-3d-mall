// Кадр кабины и проигрывание анимации надевания; виды камеры.
import * as THREE from 'three';
import {clothUpdate} from './cloth-mesh.js';
import {QC} from './qc.js';
import {rebuild} from './room-outfit.js';
import {R, built, el} from './room-scene.js';
import {ctx} from './ui.js';
import {fit} from './state.js';

  // строка автопроверки под вещью: только если вещь показана неточно (балл ниже 70) — что именно не так
  export function qcLine(e) { const q = QC[e.dataset.qc]; const bad = q && !q.ok; e.hidden = !bad; if (!bad) { e.textContent = ''; return; }
    const worst = q.checks.filter(c => !c.ok).sort((a, c) => c.pen - a.pen)[0]; e.textContent = 'Показано приблизительно (автопроверка ' + q.score + '/100): ' + (worst ? worst.why : ''); }
  export function frame() {
    if (!fit.open) return; fit.raf = requestAnimationFrame(frame);
    const c = el('fitC'), w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio, ctx.coarse ? 1.75 : 2);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { R.renderer.setPixelRatio(dpr); R.renderer.setSize(w, h, false); R.cam.aspect = w / h; R.cam.updateProjectionMatrix(); }
    rebuild();
    const H = (R.d ? R.d.H : 1.7), v = R.view, fitH = H * 1.32 * v.z, dist = Math.max(fitH / 2 / Math.tan(THREE.MathUtils.degToRad(R.cam.fov / 2)), (fitH * 0.55) / (R.cam.aspect * Math.tan(THREE.MathUtils.degToRad(R.cam.fov / 2))));
    const ty = H * (v.z < 0.9 ? v.h : 0.5 + (v.h - 0.55) * 0.3);
    R.cam.position.set(Math.sin(0.0) * dist, ty + 0.08, dist); R.cam.lookAt(0, ty, 0);
    R.avatar.rotation.y += (v.rot - R.avatar.rotation.y) * 0.25;
    if (R.play) playStep();
    R.renderer.render(R.scene, R.cam);
  }
  // кадры записаны каждые 3 шага расчёта (1/30 с) — проигрываем в реальном времени
  function playStep() {
    const P_ = R.play, k = P_.fixedK != null ? Math.min(P_.fixedK, P_.nf - 2) : Math.floor((performance.now() - P_.t0) / (1000 / 30));
    if (k >= P_.nf - 1) { // конец: точная итоговая сетка (после доводки швов и оката), поза манекена — исходная
      P_.list.forEach((g, gi) => g.children.filter(m => m.userData.cm).forEach((m, mi) => ['position', 'normal', 'color', 'wrk'].forEach((a, ai) => { const src = P_.saved[gi][mi][ai]; if (src) { m.geometry.attributes[a].array.set(src); m.geometry.attributes[a].needsUpdate = true; } })));
      R.rig.rotation.y = 0; R.rig.position.y = 0; P_.pivots.forEach(p => { p.rotation.z = p.userData.armPivot.rot; }); R.play = null; return; }
    if (k === P_.k) return; P_.k = k;
    P_.list.forEach(g => { const A = g.userData.anim, n3 = A.F.length / A.nf; clothUpdate(g, A.F.subarray(k * n3, (k + 1) * n3)); });
    const M = P_.list[0].userData.anim.M, yaw = M[k * 3], arm = M[k * 3 + 1];
    R.rig.rotation.y = yaw; R.rig.position.y = M[k * 3 + 2]; P_.pivots.forEach(p => { const a = p.userData.armPivot; p.rotation.z = a.rot + a.side * arm; });
  }
  export function replay() { built.key = ''; built.fresh = true; }
  export function view(kind) { if (kind === 'motion') return replay(); const v = R.view; if (kind === 'all') { v.z = 1; v.h = 0.55; } else if (kind === 'top') { v.z = 0.55; v.h = 0.72; } else if (kind === 'bottom') { v.z = 0.6; v.h = 0.28; } else if (kind === 'turn') v.rot += Math.PI; }
