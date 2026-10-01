// Стили интерьера магазинов (зал изнутри). base — прежний вид.
// Каждый стиль: свет и фон, текстуры пола и стен (рисуются на canvas), потолок, тип светильников,
// материалы стеллажей и вешал, таблички отделов и декор (растения, пуфы, ковры, вентиляция).
// Рисовалки получают (g, w, h, r): контекст canvas, размер и детерминированный random.

const noise = (g, w, h, r, n, a, col) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${col},${a * r()})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } };
const blotch = (g, w, h, r, n, rad, rgb, a) => { for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, R = rad * (0.4 + r());
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, R); gr.addColorStop(0, `rgba(${rgb},${a * r()})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x + dx - R, y + dy - R, R * 2, R * 2); } } };

// микроцемент: светлый, мягкие разводы
function microcement(base, rgbD, rgbL) {
  return (g, w, h, r) => { g.fillStyle = base; g.fillRect(0, 0, w, h); blotch(g, w, h, r, 40, 220, rgbD, .07); blotch(g, w, h, r, 30, 180, rgbL, .08); noise(g, w, h, r, 9000, .05, '0,0,0'); };
}
// паркет ёлочкой (доска 4:1), период совпадает с размером canvas
function herringbone(tones) {
  return (g, w, h, r) => { const bw = 64, L = 256; g.fillStyle = '#6d4c2f'; g.fillRect(0, 0, w, h);
    const board = (x, y, bx, by) => { const t = tones[Math.floor(r() * tones.length)];
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { const X = x + dx, Y = y + dy; if (X > w || Y > h || X + bx < 0 || Y + by < 0) continue;
        g.fillStyle = t; g.fillRect(X, Y, bx, by);
        g.strokeStyle = 'rgba(70,45,20,.18)'; g.lineWidth = 1; const n = 4; for (let k = 1; k < n; k++) { g.beginPath(); if (bx > by) { const yy = Y + by * k / n + (r() - .5) * 3; g.moveTo(X, yy); g.lineTo(X + bx, yy + (r() - .5) * 4); } else { const xx = X + bx * k / n + (r() - .5) * 3; g.moveTo(xx, Y); g.lineTo(xx + (r() - .5) * 4, Y + by); } g.stroke(); }
        g.strokeStyle = 'rgba(40,25,10,.55)'; g.lineWidth = 1.5; g.strokeRect(X + .5, Y + .5, bx - 1, by - 1); } };
    for (let a = -12; a < 24; a++) for (let b = -6; b < 8; b++) { const x = a * bw + b * L, y = a * bw - b * L; if (x < -L * 2 || x > w + L || y < -L * 2 || y > h + L) continue;
      board(x, y, L, bw); board(x + L, y + bw - L, bw, L); } };
}
// полированный бетон с прорезанными швами
function concrete(base) {
  return (g, w, h, r) => { g.fillStyle = base; g.fillRect(0, 0, w, h); blotch(g, w, h, r, 50, 200, '30,30,30', .12); blotch(g, w, h, r, 30, 160, '200,200,195', .07); noise(g, w, h, r, 14000, .12, '20,20,20'); noise(g, w, h, r, 5000, .1, '230,230,225');
    g.strokeStyle = 'rgba(25,25,25,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 1); g.lineTo(w, 1); g.moveTo(1, 0); g.lineTo(1, h); g.stroke();
    g.strokeStyle = 'rgba(30,30,30,.25)'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 12; k++) { x += (r() - .5) * 60; y += (r() - .3) * 40; g.lineTo(x, y); } g.stroke(); } };
}
// терраццо: светлая основа с крошкой
function terrazzo(base, chips) {
  return (g, w, h, r) => { g.fillStyle = base; g.fillRect(0, 0, w, h); blotch(g, w, h, r, 20, 200, '160,150,130', .05);
    for (let i = 0; i < 2600; i++) { const x = r() * w, y = r() * h, s = 2 + r() * (r() < .1 ? 14 : 6); g.fillStyle = chips[Math.floor(r() * chips.length)]; g.globalAlpha = .55 + r() * .45;
      g.beginPath(); const n = 5; for (let k = 0; k < n; k++) { const a = k / n * 6.28 + r(), rr = s * (.5 + r() * .5); k ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
    g.globalAlpha = 1; g.strokeStyle = 'rgba(150,140,120,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); };
}
// кирпичная кладка (1024 px = 2 м)
function brick(tones, mortar) {
  return (g, w, h, r) => { g.fillStyle = mortar; g.fillRect(0, 0, w, h); const bw = 128, bh = 33, gap = 5;
    for (let row = 0; row * bh < h; row++) { const off = row % 2 ? bw / 2 : 0; for (let x = -off; x < w; x += bw) { g.fillStyle = tones[Math.floor(r() * tones.length)]; g.fillRect(x + gap / 2, row * bh + gap / 2, bw - gap, bh - gap);
      g.fillStyle = `rgba(0,0,0,${r() * .12})`; g.fillRect(x + gap / 2, row * bh + bh - gap / 2 - 5, bw - gap, 4); g.fillStyle = `rgba(255,255,255,${r() * .06})`; g.fillRect(x + gap / 2, row * bh + gap / 2, bw - gap, 3); } }
    noise(g, w, h, r, 16000, .18, '20,10,5'); blotch(g, w, h, r, 14, 180, '235,225,210', .12); };
}
// деревянные вертикальные рейки
function slats(tones, gapCol) {
  return (g, w, h, r) => { g.fillStyle = gapCol; g.fillRect(0, 0, w, h); const sw = 32, gap = 12;
    for (let x = 0; x < w; x += sw + gap) { g.fillStyle = tones[Math.floor(r() * tones.length)]; g.fillRect(x, 0, sw, h); g.strokeStyle = 'rgba(80,50,20,.15)'; for (let k = 0; k < 4; k++) { g.beginPath(); const xx = x + 4 + r() * (sw - 8); g.moveTo(xx, 0); g.bezierCurveTo(xx + 3, h * .3, xx - 3, h * .6, xx + 2, h); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + sw - 3, 0, 3, h); } };
}
// штукатурка (лёгкая фактура)
function plaster(base) { return (g, w, h, r) => { g.fillStyle = base; g.fillRect(0, 0, w, h); blotch(g, w, h, r, 30, 200, '120,110,95', .05); blotch(g, w, h, r, 20, 160, '255,255,250', .08); noise(g, w, h, r, 6000, .04, '60,50,40'); }; }

export const INTERIORS = {
  base: { title: 'Как сейчас' },
  gallery: {
    title: 'Светлая галерея', bg: '#f3f2ef', hemi: ['#ffffff', '#c9c5be', .62], dir: ['#ffffff', .4], exp: 1,
    floor: microcement('#c9c5be', '110,104,95', '240,238,232'), floorM: 4, floorRough: .6,
    wall: '#f6f5f2', back: plaster('#f2f1ee'), ceil: '#fbfbfa', strip: 'none',
    lights: 'track', rack: ['#1d1f22', .35, .6], unit: ['#f6f5f2', '#e4e2de'], desk: '#1d1f22', deskTop: '#efeeeb', table: '#dcd9d3',
    sign: ['#ffffff', '#16181b', '#16181b'], deptMat: null, pools: .1, plants: 2, extras: [],
  },
  wood: {
    title: 'Тёплое дерево', bg: '#efe6da', hemi: ['#fff3e2', '#a68d70', .58], dir: ['#ffe6c4', .45], exp: 1,
    floor: herringbone(['#b98a5a', '#c49766', '#ad7f50', '#c9a070', '#b2834f']), floorM: 3.2, floorRough: .62,
    wall: '#efe5d6', back: slats(['#c39468', '#b98a5c', '#cc9e72'], '#4a3424'), backM: 2, ceil: '#f5ede2', strip: 'wood',
    lights: 'globe', rack: ['#a8865a', .3, .75], unit: ['#c9a477', '#b88f60'], desk: '#a87c50', deskTop: '#efe5d6', table: '#c49a6c',
    sign: ['#f6efe4', '#4a3424', '#b98a5c'], deptMat: ['#d8c6aa', .45], pools: .1, plants: 5, extras: [],
  },
  loft: {
    title: 'Лофт', bg: '#2a2a2b', hemi: ['#f3e6d4', '#3a3330', .5], dir: ['#ffd9a8', .5], exp: 1,
    floor: concrete('#56544f'), floorM: 3, floorRough: .5,
    wall: '#8a8781', back: brick(['#8e4a33', '#9a5338', '#7d3f2c', '#a65d40', '#874630'], '#cbbfae'), backM: 2, side: 'brick', ceil: '#2b2c2e', strip: 'none',
    lights: 'pendant', shelf: '#8a5f3c', rack: ['#18191b', .45, .7], unit: ['#3a3532', '#2a2624'], desk: '#2a2624', deskTop: '#9a6b44', table: '#6b4a33',
    sign: ['#18191b', '#ffffff', '#e0882f'], deptMat: null, pools: .14, plants: 3, extras: ['ducts'],
  },
  boutique: {
    title: 'Бутик', bg: '#ece6dc', hemi: ['#fff6ea', '#9c8e78', .55], dir: ['#fff0dc', .4], exp: 1,
    floor: terrazzo('#ece6dc', ['#b9ad98', '#8e8576', '#d8cfc0', '#c27c5a', '#6f7d6a', '#ffffff']), floorM: 3, floorRough: .4,
    wall: '#efe8dd', back: plaster('#2f4a3e'), side: null, ceil: '#f6f1ea', strip: 'brass',
    lights: 'downlight', shelf: '#b8925a', rack: ['#b8925a', .22, 1], unit: ['#2f4a3e', '#284035'], desk: '#2f4a3e', deskTop: '#e9e2d6', table: '#2f4a3e',
    sign: ['#2f4a3e', '#f3ead9', '#b8925a'], deptMat: null, pools: .09, plants: 4, extras: ['cove'],
    // разметка пола: тёмные каменные дорожки с латунной кромкой между отделами и светлые «ковры» под отделами
    floorPlan: { aisle: '#4f4841', vein: '200,190,175', zone: '#ddd2bd', edge: '#b8925a', aisleW: 1.05 },
  },
};
Object.keys(INTERIORS).forEach(k => { INTERIORS[k].key = k; });

// Какой стиль у какого магазина. Сначала — по названию, потом — по категории.
const BY_NAME = {
  loft: ['Gloria Jeans', 'New Yorker', 'befree', 'Terranova', 'SneakerBox', 'Zolla', 'Ostin', 'FunDay', 'Climber', 'Mrk', '5КармаNов', "Levi's", 'Top People', 'Brand Man', 'Спортмастер', 'Спортмастер Pro', 'Urbera', 'Kosmika'],
  wood: ['Детский мир', 'Король и принц', 'Mila & Kris', 'Фамилия', 'Белорусский лён', 'Kari'],
};
const BY_CAT = { fashion: 'boutique', beauty: 'boutique', acc: 'boutique', tech: 'loft', sport: 'loft', kids: 'wood', food: 'wood', gifts: 'wood', furn: 'wood', home: 'wood', serv: 'wood', misc: 'wood', tbd: 'wood' };
// у бутиков — свой глубокий цвет стены (зелёный, синий, сливовый, бордовый, графит), чтобы соседние не были одинаковыми
const BOUTIQUE_TONES = [['#2f4a3e', '#284035'], ['#22344a', '#1c2c3f'], ['#3d2e45', '#33263a'], ['#4a2c2c', '#3e2424'], ['#2e2f31', '#262729']];

export function interiorKey(s) {
  for (const [k, list] of Object.entries(BY_NAME)) if (list.includes(s.name)) return k;
  return BY_CAT[s.cat] || 'wood';
}
export function pickInterior(s, forced) {
  const key = forced && forced !== 'auto' && INTERIORS[forced] ? forced : interiorKey(s);
  const base = INTERIORS[key]; if (key !== 'boutique') return base;
  const t = BOUTIQUE_TONES[(s.id * 7 + 3) % BOUTIQUE_TONES.length];
  return Object.assign({}, base, { back: plaster(t[0]), unit: [t[0], t[1]], desk: t[0], table: t[0], sign: [t[0], '#f3ead9', '#b8925a'], wallTone: t[0] });
}
