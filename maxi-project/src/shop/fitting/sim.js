// Расчёт ткани (PBD): тяжесть, связи, швы, столкновения, движение для анимации, кадры.
import {armFlags} from './worker.js';

// расчёт: тяжесть, связи (растяжение/сжатие/изгиб — по пресету ткани), швы стягиваются постепенно, столкновения
// движение манекена для анимации примерки: поворот корпуса (рад) и отведение рук по доле u ∈ [0,1] фазы движения
// (плавно с нуля и до нуля: начало и конец без рывка)
// Движение как у человека перед зеркалом: быстрый поворот в одну сторону, в другую, лёгкое приседание-«пружинка» (вес ткани виден:
// подол отстаёт, догоняет и раскачивается), руки чуть в стороны. dy — подъём тела (м)
export function motionAt(u) { const w = Math.sin(Math.PI * u), e = w * w;
  return {yaw: 0.5 * Math.sin(2 * Math.PI * u) * Math.pow(w, 0.6), arm: 0.3 * e, dy: -0.022 * Math.sin(3 * Math.PI * u) * e}; }
// opt.rec — записать кадры (каждые 3 шага с момента, когда вещь сшита) и добавить фазу движения (MOT шагов) и успокоения
export function runCloth(C, push, fab, yPin, opt) {
  const n = C.pin.length, P = new Float32Array(C.P), V = new Float32Array(n * 3), prev = new Float32Array(n * 3), E = C.E, S = C.seams, hit = new Uint8Array(n);
  const NA = C.noArm || (C.meshes ? armFlags(C) : null);
  const TH = C.tether && C.tether.length ? C.tether : null;
  const S0 = S.map(([i, j]) => Math.hypot(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]));
  let FIX = null; const HX = C.hold ? P.slice() : null;
  // капюшон на голове: касающиеся точки не скользят (держится на волосах), иначе тяжесть стаскивает его назад
  const STK = C.stickyIds ? new Uint8Array(n) : null; if (STK) C.stickyIds.forEach(i => { STK[i] = 1; });
  const DBG = typeof window !== 'undefined' ? window : {};   // __dsteps — остановить расчёт раньше (отладка)
  // C.hq — «офлайн-качество» для проб (лаборатория, флаг __hq): больше проходов и шагов, ткань сталкивается сама с собой
  const HQ = C.hq || null;
  const REC = opt && opt.rec, base = (HQ && HQ.steps) || DBG.__dsteps || 320, MOT = REC ? 144 : 0, steps = base + (REC ? MOT + 84 : 0), iters = (HQ && HQ.iters) || 7, dt = 1 / 90, sewEnd = 128;
  // самостолкновение: точки разных мест ткани не ближе selfR (соседи по выкройке и сшитые пары — не в счёт)
  const SR = HQ && HQ.selfR, SR2 = SR ? SR * SR : 0, sewnP = SR ? new Set(S.map(([i, j]) => i < j ? i * 1e6 + j : j * 1e6 + i)) : null, P0 = SR ? new Float32Array(C.P) : null;
  const selfCollide = () => { const cs = SR * 2, H = new Map(), key = (x, y, z) => ((Math.floor(x / cs) * 73856093) ^ (Math.floor(y / cs) * 19349663) ^ (Math.floor(z / cs) * 83492791));
    for (let i = 0; i < n; i++) { const k = key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); let L = H.get(k); if (!L) H.set(k, L = []); L.push(i); }
    for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], cx = Math.floor(x / cs), cy = Math.floor(y / cs), cz = Math.floor(z / cs);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const L = H.get(((cx + a) * 73856093) ^ ((cy + b) * 19349663) ^ ((cz + c) * 83492791)); if (!L) continue;
        for (const j of L) { if (j <= i) continue; const dx = P[j * 3] - x, dy = P[j * 3 + 1] - y, dz = P[j * 3 + 2] - z, d2 = dx * dx + dy * dy + dz * dz; if (d2 >= SR2 || d2 < 1e-12) continue;
          // соседи по выкройке (были рядом в начале — та же деталь) и сшитые пары не отталкиваются
          const ex = P0[j * 3] - P0[i * 3], ey = P0[j * 3 + 1] - P0[i * 3 + 1], ez = P0[j * 3 + 2] - P0[i * 3 + 2]; if (ex * ex + ey * ey + ez * ez < SR2 * 9) continue;
          if (sewnP.has(i < j ? i * 1e6 + j : j * 1e6 + i)) continue;
          const d = Math.sqrt(d2), c_ = (SR - d) / d * 0.5; if (!C.pin[i]) { P[i * 3] -= dx * c_; P[i * 3 + 1] -= dy * c_; P[i * 3 + 2] -= dz * c_; } if (!C.pin[j]) { P[j * 3] += dx * c_; P[j * 3 + 1] += dy * c_; P[j * 3 + 2] += dz * c_; } } } } };
  const frames = REC ? [] : null, fmeta = REC ? [] : null; let yawPrev = 0, dyPrev = 0, still = null;   // still — покой до движения (итог)
  // доводка точек для показа (итог и каждый кадр анимации): сглаживание «лесенки» сетки (2 прохода) с повторной проверкой
  // столкновений и сведение сшитых точек (остаток зазора после расчёта — иначе виден просвет по шву). Без неё кадры анимации
  // выходили «мятыми» (рябь в размер ячейки сетки), а итог — гладким
  const nb = Array.from({length: n}, () => []); for (let e = 0; e < E.length; e += 4) if (E[e + 3] === 0 || E[e + 3] === 3) { nb[E[e]].push(E[e + 1]); nb[E[e + 1]].push(E[e]); }
  for (const [i, j] of S) { nb[i].push(j); nb[j].push(i); }
  const finishP = X => {
    for (let pass = 0; pass < 2; pass++) { const Q = X.slice(); for (let i = 0; i < n; i++) { const L = nb[i]; if (!L.length) continue; let x = 0, y = 0, z = 0; for (const t of L) { x += Q[t * 3]; y += Q[t * 3 + 1]; z += Q[t * 3 + 2]; }
      X[i * 3] = (Q[i * 3] + x / L.length) / 2; X[i * 3 + 1] = (Q[i * 3 + 1] + y / L.length) / 2; X[i * 3 + 2] = (Q[i * 3 + 2] + z / L.length) / 2; push(X, i * 3, NA && NA[i]); } }
    for (let pass = 0; pass < 2; pass++) for (const [i, j] of S) { const d2 = Math.hypot(X[j * 3] - X[i * 3], X[j * 3 + 1] - X[i * 3 + 1], X[j * 3 + 2] - X[i * 3 + 2]); if (d2 > 0.05) continue;
      for (let k = 0; k < 3; k++) { const m = (X[i * 3 + k] + X[j * 3 + k]) / 2; X[i * 3 + k] = m; X[j * 3 + k] = m; } }
    return X; };
  for (let s = 0; s < steps; s++) {
    const ramp = Math.min(1, s / sewEnd), gk = s < sewEnd ? 0 : Math.min(1, (s - sewEnd) / 25);
    // фаза движения: тело поворачивается на Δψ — в системе тела ткань по инерции поворачивается на −Δψ (точки и прошлые точки вместе)
    if (MOT && s === base) still = P.slice();
    let mo = null; if (MOT && s >= base && s < base + MOT) { mo = motionAt((s - base + 1) / MOT); const dpsi = mo.yaw - yawPrev; yawPrev = mo.yaw;
      const ddy = mo.dy - dyPrev; dyPrev = mo.dy;
      if (dpsi || ddy) { const c = Math.cos(-dpsi), sn = Math.sin(-dpsi); for (let i = 0; i < n; i++) { if (C.pin[i]) continue; const q = i * 3;
        let x = P[q], z = P[q + 2]; P[q] = x * c + z * sn; P[q + 2] = -x * sn + z * c; P[q + 1] -= ddy; x = V[q]; z = V[q + 2]; V[q] = x * c + z * sn; V[q + 2] = -x * sn + z * c; } }
      if (push.setArm) push.setArm(mo.arm); }
    else if (MOT && s === base + MOT && push.setArm) { push.setArm(0); yawPrev = 0; dyPrev = 0; }
    prev.set(P);
    // пояс: пока шьём — держится только по высоте, потом застёгнут (не съезжает и не проворачивается)
    if (s === Math.round(sewEnd)) { FIX = P.slice(); }
    if (C.force && s >= sewEnd) for (const F of C.force) if (F.all || s < sewEnd + 90) for (const i of F.ids) { V[i * 3] += F.f[0] * dt; V[i * 3 + 1] += F.f[1] * dt; V[i * 3 + 2] += F.f[2] * dt; }
    for (let i = 0; i < n; i++) { const q = i * 3; V[q + 1] -= 9.8 * gk * dt; P[q] += V[q] * dt; P[q + 1] += V[q + 1] * dt; P[q + 2] += V[q + 2] * dt; if (C.pin[i]) { P[q + 1] = yPin; if (FIX) { P[q] = FIX[q]; P[q + 2] = FIX[q + 2]; } } }
    for (let it = 0; it < iters; it++) {
      for (let e = 0; e < E.length; e += 4) {
        const i = E[e], j = E[e + 1], rest = E[e + 2], kind = E[e + 3], a3 = i * 3, b3 = j * 3;
        const dx = P[b3] - P[a3], dy = P[b3 + 1] - P[a3 + 1], dz = P[b3 + 2] - P[a3 + 2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, diff = len - rest;
        const k = kind === 2 ? (diff > 0 || fab.mem ? fab.bend : fab.bend * 0.4) : (diff > 0 ? fab.stretch : kind === 3 ? (fab.compW || 0.5) : fab.comp); if (!k) continue;
        const c = k * diff / len * 0.5, wa = C.pin[i] ? 0 : 1, wb = C.pin[j] ? 0 : 1;
        P[a3] += dx * c; P[a3 + 1] += dy * c * wa; P[a3 + 2] += dz * c; P[b3] -= dx * c; P[b3 + 1] -= dy * c * wb; P[b3 + 2] -= dz * c;
      }
      for (let rep = 0; rep < 2; rep++) for (let k = 0; k < S.length; k++) { const [i, j] = S[k], a3 = i * 3, b3 = j * 3, gx = P[b3] - P[a3], gy = P[b3 + 1] - P[a3 + 1], gz = P[b3 + 2] - P[a3 + 2], len = Math.hypot(gx, gy, gz) || 1e-6, rest = S0[k] * (1 - ramp), diff = len - rest;
        if (diff > 0) { const c = 0.5 * diff / len; P[a3] += gx * c; P[a3 + 1] += gy * c; P[a3 + 2] += gz * c; P[b3] -= gx * c; P[b3 + 1] -= gy * c; P[b3 + 2] -= gz * c; } }
      if (TH && s >= sewEnd) for (let t = 0; t < TH.length; t += 3) { const i = TH[t] * 3, a = TH[t + 1] * 3, r = TH[t + 2], dx = P[i] - P[a], dy = P[i + 1] - P[a + 1], dz = P[i + 2] - P[a + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (l > r) { const k = (l - r) / l; P[i] -= dx * k; P[i + 1] -= dy * k; P[i + 2] -= dz * k; } }
      if (C.hold && s < sewEnd + 20) for (const i of C.hold) P[i * 3] = HX[i * 3];
      if (C.mid) for (const [a, b] of C.mid) { const m = (P[a * 3] + P[b * 3]) / 2; P[a * 3] -= m; if (b !== a) P[b * 3] -= m; }
      if (C.sector && s > sewEnd * 0.6) for (const [i, fz, sx_, cx] of C.sector) { const q = i * 3;
        if (P[q + 2] * fz < -0.005) P[q + 2] += (-0.005 * fz - P[q + 2]) * 0.3;
        if (sx_ && (P[q] - cx) * sx_ < 0) P[q] += (cx - P[q]) * 0.3; }
      // пояс стягивает ткань к телу (belt3d.js): точка не дальше эллипса a×b на своей высоте
      if (C.belt && s > sewEnd * 0.6) { const B_ = C.belt; for (let t = 0; t < B_.length; t += 3) { const q = B_[t] * 3, x = P[q], z = P[q + 2], e = (x / B_[t + 1]) ** 2 + (z / B_[t + 2]) ** 2;
        if (e > 1) { const f = 1 + (1 / Math.sqrt(e) - 1) * 0.5; P[q] *= f; P[q + 2] *= f; } } }
      if (C.half && s > sewEnd * 0.6) for (const [i, sg] of C.half) if (P[i * 3] * sg < 0.004) P[i * 3] += (sg * 0.004 - P[i * 3]) * 0.3;
      if (SR && s >= sewEnd && it % 2 === 0) selfCollide();
      for (let i = 0; i < n; i++) { if (push(P, i * 3, NA && NA[i])) hit[i] = 1; if (C.pin[i]) { P[i * 3 + 1] = yPin; if (FIX) { P[i * 3] = FIX[i * 3]; P[i * 3 + 2] = FIX[i * 3 + 2]; } } }
    }
    // трение о тело: касающаяся точка почти не скользит (иначе тяжёлые рукава стаскивают вещь с плеч)
    // у брюк трение о ноги сильнее: иначе тесная штанина под своей тяжестью проворачивается вокруг ноги и соскакивает с неё
    const FR = C.fr || 0.3;
    if (FR < 1) for (let i = 0; i < n; i++) if (hit[i] && !C.pin[i]) { const q = i * 3, fr = STK && STK[i] && s >= sewEnd ? 0 : FR; for (let k = 0; k < 3; k++) P[q + k] = prev[q + k] + (P[q + k] - prev[q + k]) * fr; push(P, q, NA && NA[i]); }
    // сопротивление воздуха — слабое (раньше 0.985 за шаг: ткань двигалась как в киселе — «вакуум» без веса и размаха);
    // пока вещь садится (до движения) — сильнее, чтобы быстрее успокоилась
    const air = MOT && s >= base ? 0.994 : 0.985, cf = MOT && s >= base ? 0.6 : 0.4;
    for (let i = 0; i < n * 3; i++) V[i] = (P[i] - prev[i]) / dt * air;
    for (let i = 0; i < n; i++) if (hit[i]) { V[i * 3] *= cf; V[i * 3 + 1] *= cf; V[i * 3 + 2] *= cf; hit[i] = 0; }
    // после движения ткань плавно возвращается в покой до движения: жёсткая ткань «помнит» случайные заломы, и итог хуже исходного
    /* кадры — с момента, когда ткань уже легла под своим весом (до этого — «надутая») */
    if (REC && s >= sewEnd + 24 && (s - sewEnd) % 3 === 0) { let Fr = P.slice(); if (still && s >= base + MOT) { const w = Math.min(1, (s - base - MOT) / ((steps - base - MOT) * 0.85)), ww = w * w * (3 - 2 * w); for (let i = 0; i < Fr.length; i++) Fr[i] += (still[i] - Fr[i]) * ww; }
      frames.push(finishP(Fr)); const m_ = MOT && s >= base && s < base + MOT ? motionAt((s - base + 1) / MOT) : {yaw: 0, arm: 0, dy: 0}; fmeta.push(m_.yaw, m_.arm, m_.dy || 0); }
  }
  if (still) P.set(still);   // итог — покой до движения (тот же, что без анимации)
  finishP(P);
  if (REC) { frames.push(P.slice()); fmeta.push(0, 0, 0); const F = new Float32Array(frames.length * P.length); frames.forEach((f, k) => F.set(f, k * P.length)); opt.frames = F; opt.meta = Float32Array.from(fmeta); opt.nf = frames.length; }
  return P;
}
