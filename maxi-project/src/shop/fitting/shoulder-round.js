// Плечевая точка после расчёта: там сходятся угол переда, угол спинки и верх оката рукава — ткань вставала острым углом
// («полка» плеча и почти отвесный рукав). Скругляем угол внутрь: точки ткани в радиусе R от плечевой точки (корпус и рукав
// вместе; сшитые пары — как одна точка) несколько раз подтягиваются к среднему соседей (сильнее у центра, к краю круга — на нет)
// и выталкиваются из тела. Вызывать до укладки оката на пройму (drape.js finish): кольцо рукава ляжет уже на скруглённую пройму.
export function shoulderRound(C, P, chains, push, R = 0.05, passes = 8) {
  if (!chains.length) return;
  const n = P.length / 3, par = new Int32Array(n).map((_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  for (const [a, b] of C.seams) { const ra = f(a), rb = f(b); if (ra !== rb) par[ra] = rb; }
  const nb = new Map(), add = (a, b) => { a = f(a); b = f(b); if (a === b) return; if (!nb.has(a)) nb.set(a, new Set()); nb.get(a).add(b); };
  for (let e = 0; e < C.E.length; e += 4) { const k = C.E[e + 3]; if (k !== 0 && k !== 3) continue; add(C.E[e], C.E[e + 1]); add(C.E[e + 1], C.E[e]); }   // соседи по сетке (не диагонали и не через клетку)
  const members = new Map(); for (let i = 0; i < n; i++) { const r = f(i); if (!members.has(r)) members.set(r, []); members.get(r).push(i); }
  const avg = r => { const m = members.get(r); if (m.length < 2) return; for (let q = 0; q < 3; q++) { let s = 0; m.forEach(i => { s += P[i * 3 + q]; }); P[r * 3 + q] = s / m.length; } };
  chains.forEach(({lf, lb}) => { const s = f(lf[0]); avg(s); const cx = P[s * 3], cy = P[s * 3 + 1], cz = P[s * 3 + 2], sel = [];
    nb.forEach((_, r) => { const d = Math.hypot(P[r * 3] - cx, P[r * 3 + 1] - cy, P[r * 3 + 2] - cz); if (d < R) { avg(r); sel.push([r, 1 - (d / R) * (d / R)]); } });
    for (let pass = 0; pass < passes; pass++) {
      const Q = sel.map(([r]) => { let x = 0, y = 0, z = 0, c = 0; nb.get(r).forEach(o => { x += P[o * 3]; y += P[o * 3 + 1]; z += P[o * 3 + 2]; c++; }); return [x / c, y / c, z / c]; });
      sel.forEach(([r, w], k) => { for (let q = 0; q < 3; q++) P[r * 3 + q] += (Q[k][q] - P[r * 3 + q]) * 0.5 * w; push(P, r * 3); }); }
    // сглаживание стягивает круг к центру — рёбра у его края растягиваются; отпускаем: ребро длиннее выкройки укорачиваем
    // (двигаются только точки круга), как в расчёте ткани
    const mov = new Map(sel.map(([r, w]) => [r, w])), E = [];
    for (let e = 0; e < C.E.length; e += 4) { const k = C.E[e + 3]; if (k > 1 && k !== 3) continue; const a = f(C.E[e]), b = f(C.E[e + 1]); if (a !== b && (mov.has(a) || mov.has(b))) E.push(a, b, C.E[e + 2]); }
    for (let it = 0; it < 12; it++) { for (let e = 0; e < E.length; e += 3) { const a = E[e], b = E[e + 1], rest = E[e + 2], dx = P[b * 3] - P[a * 3], dy = P[b * 3 + 1] - P[a * 3 + 1], dz = P[b * 3 + 2] - P[a * 3 + 2], l = Math.hypot(dx, dy, dz);
        if (l <= rest * 1.01) continue; const ma = mov.has(a) ? 1 : 0, mb = mov.has(b) ? 1 : 0, c = (l - rest * 1.01) / l / (ma + mb);
        if (ma) { P[a * 3] += dx * c; P[a * 3 + 1] += dy * c; P[a * 3 + 2] += dz * c; } if (mb) { P[b * 3] -= dx * c; P[b * 3 + 1] -= dy * c; P[b * 3 + 2] -= dz * c; } }
      mov.forEach((_, r) => push(P, r * 3)); }
    sel.forEach(([r]) => members.get(r).forEach(i => { if (i !== r) { P[i * 3] = P[r * 3]; P[i * 3 + 1] = P[r * 3 + 1]; P[i * 3 + 2] = P[r * 3 + 2]; } })); });
}
