// Одна вещь: выкройка → расчёт (кэш, фон или здесь) → сетка.
import {cacheGet, cachePut} from './cache.js';
import {makeCollider} from './collider.js';
import {drapePrepare} from './drape.js';
import {garmentMesh} from './garment.js';
import {QC} from './qc.js';
import {runCloth} from './sim.js';
import {solveInWorker} from './worker.js';
import {fit} from './state.js';

// одна вещь: подготовка здесь, расчёт — из кэша, в фоне или (если фон недоступен) здесь же
export async function garmentMeshAsync(item, d, key, alive, opts) {
  if (!item.tex) return garmentMesh(item, d);
  delete QC[item.id];
  const un = fit.UNDER ? {a: fit.UNDER.slice(), b: fit.UNDERZ.slice()} : null, job = drapePrepare(item, d, un);
  if (!job) return garmentMesh(item, d);
  // anim: показать надевание в движении — только при новом расчёте (из кэша вещь сразу на месте); ключ кэша свой: итог после движения
  const anim = !!(opts && opts.anim); if (key && anim) key += '|a';
  let P = key && !(opts && opts.fresh) ? await cacheGet(key) : null, A = null;
  if (!P) { job.rec = anim; P = await solveInWorker(job); if (alive && !alive()) return null;
    if (!P) { const o = {rec: anim}; P = runCloth(job.C, makeCollider(job.d, job.under, job.margin), job.fab, job.yPin, o); if (o.frames) P.anim = {F: o.frames, M: o.meta, nf: o.nf}; }
    A = P.anim || null; if (key) cachePut(key, P); }
  if (alive && !alive()) return null;
  const g = job.finish(Float32Array.from(P)); if (g && A) g.userData.anim = Object.assign(A, {C: job.C}); return g;
}
