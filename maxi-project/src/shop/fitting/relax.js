// Расслабление растянутой ткани после расчёта и доводки (drape.js finish). В расчёте точка, касающаяся тела, почти не скользит
// (трение) — у верха рукава на плече и под мышкой растянутая ткань «застревала»: связи длиннее выкройки на 30–80%, треугольники
// вытягивались, и на верхушке рукава было видно насквозь (автопроверка: «очаги» на плече и под мышкой у всех верхов).
// Здесь — без трения: связи (основа, уток, диагонали) длиннее выкройки больше чем на `lim` укорачиваются, сшитые точки
// двигаются вместе (одна точка), закреплённые (C.pin) стоят, после каждого прохода ткань выталкивается из тела.
// Сжатые связи не трогаются (складки остаются), слабо растянутые — тоже (провис под тяжестью не меняется).
export function relaxStretch(C, P, push, lim = 1.06, iters = 40) {
  const n = P.length / 3, par = new Int32Array(n).map((_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  for (const [a, b] of C.seams) { const ra = f(a), rb = f(b); if (ra !== rb) par[ra] = rb; }
  const members = new Map(); for (let i = 0; i < n; i++) { const r = f(i); if (!members.has(r)) members.set(r, []); members.get(r).push(i); }
  const pinned = new Uint8Array(n); members.forEach((m, r) => { if (m.some(i => C.pin[i])) pinned[r] = 1; });
  // сшитые точки — в одно место (середина): доводка оката могла развести пары на миллиметры
  members.forEach((m, r) => { if (m.length < 2) return; const fix = m.find(i => C.pin[i]); for (let q = 0; q < 3; q++) { let s = 0; m.forEach(i => { s += P[i * 3 + q]; }); P[r * 3 + q] = fix != null ? P[fix * 3 + q] : s / m.length; } });
  const E = []; for (let e = 0; e < C.E.length; e += 4) { const k = C.E[e + 3]; if (k > 1 && k !== 3) continue; const a = f(C.E[e]), b = f(C.E[e + 1]); if (a !== b) E.push(a, b, C.E[e + 2]); }
  const moved = new Uint8Array(n);
  for (let it = 0; it < iters; it++) { let any = 0;
    for (let e = 0; e < E.length; e += 3) { const a = E[e], b = E[e + 1], rest = E[e + 2] * lim, dx = P[b * 3] - P[a * 3], dy = P[b * 3 + 1] - P[a * 3 + 1], dz = P[b * 3 + 2] - P[a * 3 + 2], l = Math.hypot(dx, dy, dz);
      if (l <= rest) continue; const wa = pinned[a] ? 0 : 1, wb = pinned[b] ? 0 : 1; if (!wa && !wb) continue; const c = (l - rest) / l / (wa + wb); any = 1;
      if (wa) { P[a * 3] += dx * c; P[a * 3 + 1] += dy * c; P[a * 3 + 2] += dz * c; moved[a] = 1; } if (wb) { P[b * 3] -= dx * c; P[b * 3 + 1] -= dy * c; P[b * 3 + 2] -= dz * c; moved[b] = 1; } }
    if (!any) break;
    for (let r = 0; r < n; r++) if (moved[r] && !pinned[r]) push(P, r * 3); }
  members.forEach((m, r) => { if (m.length > 1) m.forEach(i => { if (i !== r) { P[i * 3] = P[r * 3]; P[i * 3 + 1] = P[r * 3 + 1]; P[i * 3 + 2] = P[r * 3 + 2]; } }); });
}
