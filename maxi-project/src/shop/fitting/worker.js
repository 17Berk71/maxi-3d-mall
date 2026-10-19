// Расчёт ткани в фоновом потоке (Web Worker) и версия расчёта CLOTH_VER.
import {armX, sx, sz, torsoR} from './body.js';
import {legR, makeCollider, meshCollider} from './collider.js';
import {armJ, armRad} from './geometry.js';
import {motionAt, runCloth} from './sim.js';

// ---------- расчёт ткани в фоновом потоке и кэш ----------
// Расчёт вещи — 1.5–2.5 с на компьютере и в 2–3 раза дольше на телефоне. В фоне страница не замирает,
// а готовый результат (точки ткани) хранится: та же вещь на той же фигуре во второй раз надевается сразу.
// Версия расчёта: менять при любой правке выкроек, швов или расчёта — старый кэш станет недействительным.
export const CLOTH_VER = 'c95';
// анимация надевания (FIT.setAnim(false) — выключить, для автопроверок); «без анимации» на сайте и системная настройка — тоже выключают
export const ANIM = {on: true};
export function calmNow() { try { const v = localStorage.getItem('maxi-calm'); if (v !== null) return v === '1'; } catch (e) {} try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
let WORKER = null, WSEQ = 0; const WJOBS = new Map();
function clothWorker() {
  if (WORKER !== null) return WORKER;
  try {
    // код расчёта берём из этих же функций (toString): отдельный файл не нужен ни Vite, ни сборке артефакта
    const src = [torsoR, sx, sz, armRad, armX, armJ, legR, makeCollider, meshCollider, motionAt, runCloth].map(f => { const t = f.toString(); return /^function[\s*(]/.test(t) ? t : 'const ' + f.name + ' = ' + t + ';'; }).join('\n')
      + '\nself.onmessage = e => { const {id, C, d, under, fab, yPin, margin, rec} = e.data; try { const o = {rec}; const P = runCloth(C, makeCollider(d, under, margin), fab, yPin, o); self.postMessage({id, P, F: o.frames, M: o.meta, nf: o.nf}, o.frames ? [P.buffer, o.frames.buffer] : [P.buffer]); } catch (err) { self.postMessage({id, err: String(err && err.message || err)}); } };';
    WORKER = new Worker(URL.createObjectURL(new Blob([src], {type: 'text/javascript'})));
    WORKER.onmessage = e => { const j = WJOBS.get(e.data.id); if (!j) return; WJOBS.delete(e.data.id); if (e.data.err) { console.warn('расчёт ткани в фоне не удался, считаю здесь:', e.data.err); WORKER = false; j.reject(new Error(e.data.err)); } else { if (e.data.F) e.data.P.anim = {F: e.data.F, M: e.data.M, nf: e.data.nf}; j.resolve(e.data.P); } };
    WORKER.onerror = () => { WJOBS.forEach(j => j.reject(new Error('worker'))); WJOBS.clear(); WORKER = false; };
  } catch (e) { WORKER = false; }
  return WORKER;
}
// изгиб через шов деталь–деталь (бок, плечо, шаг, сидение, капюшон): без него шов — шарнир, и бок под тяжестью
// складывается внутрь острой складкой — сбоку вещь выглядит «перетянутой». Связь — между соседями шва внутри деталей,
// длина покоя — как у ровного шва. Пройму (рукав к корпусу) не трогаем: там угол настоящий.
export function seamBend(C) {
  const n = C.pin.length, panel = new Uint8Array(n), inSeam = new Uint8Array(n), adj = Array.from({length: n}, () => []);
  C.meshes.forEach(m => { if (!m.local) m.verts.forEach(v => { panel[v] = 1; }); });
  C.seams.forEach(([i, j]) => { inSeam[i] = 1; inSeam[j] = 1; });
  for (let e = 0; e < C.E.length; e += 4) { const k = C.E[e + 3]; if (k === 0 || k === 3) { adj[C.E[e]].push([C.E[e + 1], C.E[e + 2], k]); adj[C.E[e + 1]].push([C.E[e], C.E[e + 2], k]); } }
  // сосед внутрь детали: у бокового шва — по утку (горизонтальный), иначе по основе; ровно один
  const inner = i => { const L = adj[i].filter(([q]) => !inSeam[q]); const w = L.filter(e => e[2] === 3); return (w.length ? w : L).slice(0, 1); };
  let yMax = -9; for (let i = 0; i < n; i++) if (panel[i]) yMax = Math.max(yMax, C.P[i * 3 + 1]);
  C.seams.forEach(([i, j]) => { if (!panel[i] || !panel[j]) return;
    // плечевой шов (верх вещи) гнётся свободнее: ткань перекидывается через плечо, а почти прямой шов держал над плечом «полку» с углом
    const k = Math.min(C.P[i * 3 + 1], C.P[j * 3 + 1]) > yMax - 0.07 ? 0.9 : 0.98;
    for (const [a, la] of inner(i)) for (const [b, lb] of inner(j)) C.link(a, b, (la + lb) * k, 2); });
}
// точки деталей корпуса (не труб рукавов) — для makeCollider (noArm)
export function armFlags(C) { const f = new Uint8Array(C.pin.length); C.meshes.forEach(m => { if (!m.local) m.verts.forEach(v => { f[v] = 1; }); }); return f; }
export function solveInWorker(job) {
  const w = clothWorker(); if (!w) return Promise.resolve(null);
  const id = ++WSEQ, C = job.C, msg = {id, C: {P: Float32Array.from(C.P), E: C.E, seams: C.seams, pin: C.pin, hold: C.hold, mid: C.mid, half: C.half, sector: C.sector, belt: C.belt || null, force: C.force, stickyIds: C.stickyIds, fr: C.fr, noArm: C.noArm || armFlags(C), tether: Float32Array.from(C.tether || []), hq: C.hq || null}, d: job.d, under: job.under, fab: typeof window !== 'undefined' && window.__fab ? Object.assign({}, job.fab, window.__fab) : job.fab, yPin: job.yPin, margin: job.margin, rec: !!job.rec};   // __fab — проба ткани (отладка)
  return new Promise((resolve, reject) => { WJOBS.set(id, {resolve, reject}); w.postMessage(msg); }).catch(() => null);
}
