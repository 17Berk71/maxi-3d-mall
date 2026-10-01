// Айдентика магазинов: цвета, шрифт и форма вывески.
// 1) цвета: BRANDS — узнаваемые цвета известных сетей (приблизительно, без логотипов);
//    остальным — своя пара цветов от категории, у каждого магазина немного другая;
// 2) шрифт по типу магазина; 3) форма: объёмные буквы на фризе, световой короб или плашка;
// 4) цвет бренда на фасаде: полоса под фризом, коврик у входа, консольная табличка поперёк коридора.

// [фон, буквы, форма?]  форма: 'letters' — буквы без плашки, 'box' — световой короб, 'band' — плашка
export const BRANDS = {
  'МТС': ['#e30611', '#ffffff', 'box'], 'билайн': ['#ffd200', '#111111', 'box'], 'МегаФон | Yota': ['#00b956', '#ffffff', 'box'],
  'T2': ['#111111', '#ffffff', 'box'], 'ДНС': ['#f68b1f', '#ffffff', 'box'], 'Спортмастер': ['#0a4ea2', '#ffffff', 'box'],
  'Спортмастер Pro': ['#0a4ea2', '#ffffff', 'box'], 'Детский мир': ['#0067b1', '#ffffff', 'box'], 'Лэтуаль': ['#111111', '#ffffff', 'letters'],
  'Рив Гош': ['#111111', '#ffffff', 'letters'], 'Yves Rocher': ['#1f6b3a', '#ffffff', 'box'], 'Kari': ['#e4007c', '#ffffff', 'box'],
  'Читай-город': ['#e3262f', '#ffffff', 'box'], 'Перекрёсток Select': ['#0d7d3f', '#ffffff', 'box'], 'Sokolov': ['#111111', '#ffffff', 'letters'],
  'Love Republic': ['#111111', '#ffffff', 'letters'], 'befree': ['#111111', '#ffffff', 'box'], 'Lamoda Sport': ['#111111', '#ffffff', 'box'],
  'The iStore': ['#1d1d1f', '#ffffff', 'box'], 'Четыре Лапы': ['#f47b20', '#ffffff', 'box'], 'Gloria Jeans': ['#1d2a5c', '#ffffff', 'box'],
  'Ostin': ['#1c2b4a', '#ffffff', 'box'], 'Zolla': ['#111111', '#ffffff', 'box'], 'Askona': ['#00539f', '#ffffff', 'box'],
  'Ormatek': ['#1a3e8c', '#ffffff', 'box'], 'Синема Парк': ['#5b2a86', '#ffffff', 'box'], 'Лента': ['#003c96', '#ffd200', 'box'],
};

// шрифты: имя семейства и начертание для canvas
export const FONTS = {
  serif: ['Playfair Display', 700, false], cond: ['Oswald', 600, true], round: ['Nunito', 900, false],
  script: ['Pacifico', 400, false], sans: ['Manrope', 800, false],
};
export const FONT_LOADS = ['700 40px "Playfair Display"', '600 40px Oswald', '900 40px Nunito', '400 40px Pacifico'];

const LOFTY = ['Gloria Jeans', 'New Yorker', 'befree', 'Terranova', 'SneakerBox', 'Zolla', 'Ostin', 'FunDay', 'Climber', 'Mrk', '5КармаNов', "Levi's", 'Top People', 'Brand Man', 'Urbera', 'Kosmika'];
function lum(c) { if (c[0] !== '#') return 0.5; const n = parseInt(c.slice(1), 16); return ((n >> 16 & 255) * .3 + (n >> 8 & 255) * .59 + (n & 255) * .11) / 255; }
function hsl(h, s, l) { return `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`; }

export function signStyle(s, catHue) {
  const b = BRANDS[s.name];
  let font = 'sans', shape = 'band';
  if (s.cat === 'acc' || s.cat === 'beauty') { font = 'serif'; shape = 'letters'; }
  else if (s.cat === 'fashion') { if (LOFTY.includes(s.name)) { font = 'cond'; shape = 'box'; } else { font = 'serif'; shape = 'letters'; } }
  else if (s.cat === 'sport' || s.cat === 'tech') { font = 'cond'; shape = 'box'; }
  else if (s.cat === 'kids' || s.cat === 'gifts') { font = 'round'; shape = 'box'; }
  else if (s.cat === 'food') { font = /кофе|coffee|барист|пекар|хлеб|десерт|сладк/i.test(s.name + ' ' + (s.what || '')) ? 'script' : 'round'; shape = 'box'; }
  if (b) return { bg: b[0], fg: b[1], shape: s.kind === 'kiosk' && b[2] === 'letters' ? 'box' : b[2] || shape, font, brand: true };
  // у островков нет фриза под буквами — там всегда световой короб
  if (s.kind === 'kiosk' && shape === 'letters') { const T = LETTER_TONES[(s.id * 7 + 3) % LETTER_TONES.length]; return { bg: T[0], fg: T[1], shape: 'box', font }; }
  // своя пара цветов. Буквы на фризе — на панели одного из благородных тонов, буквы белые, золотые или тёмные на светлом;
  // короба и плашки — оттенок категории, сдвинутый по id магазина, в светлом или тёмном варианте
  const v = s.id % 3;
  if (shape === 'letters') { const T = LETTER_TONES[(s.id * 7 + 3) % LETTER_TONES.length]; return { bg: T[0], fg: T[1], shape, font }; }
  const h = (catHue + ((s.id * 47) % 90) - 45 + 360) % 360;
  if (v === 0) return { bg: hsl(h, 62, 38), fg: '#ffffff', shape, font };
  if (v === 1) return { bg: '#f7f4ee', fg: hsl(h, 65, 34), shape, font };
  return { bg: hsl(h, 35, 16), fg: hsl(h, 80, 72), shape, font };
}
const LETTER_TONES = [['#1f2a44', '#ffffff'], ['#3b2030', '#e8c46a'], ['#22382f', '#f3ead9'], ['#111111', '#e8c46a'], ['#5a1e24', '#ffffff'],
  ['#ece5d8', '#1d1d1f'], ['#2e2f31', '#ffffff'], ['#f6f1ea', '#7a1f2b'], ['#26304a', '#e8c46a'], ['#3a2a1e', '#f3ead9']];

function setFont(g, st, text, maxW, maxH) {
  const [fam, wt, up] = FONTS[st.font]; const t = up ? text.toUpperCase() : text; let px = maxH;
  for (; px > 10; px -= 1) { g.font = `${wt} ${px}px "${fam}", Manrope, system-ui, sans-serif`; if (g.measureText(t).width <= maxW) break; }
  return t;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// основная вывеска: ячейка w×h атласа (512×64)
export function drawSign(g, x, y, w, h, s, st) {
  g.clearRect(x, y, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
  if (st.shape === 'letters') {
    const t = setFont(g, st, s.name, w - 30, st.font === 'serif' ? 46 : 42);
    const light = lum(st.fg) > 0.5;
    g.shadowColor = light ? 'rgba(255,248,230,.9)' : 'rgba(0,0,0,0)'; g.shadowBlur = light ? 9 : 0; g.fillStyle = st.fg; g.fillText(t, x + w / 2, y + h / 2);
    g.shadowBlur = 0; return;
  }
  if (st.shape === 'box') { g.fillStyle = st.bg; rr(g, x + 3, y + 3, w - 6, h - 6, 12); g.fill(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; rr(g, x + 5, y + 5, w - 10, h - 10, 10); g.stroke(); }
  else { g.fillStyle = st.bg; g.fillRect(x, y, w, h); g.fillStyle = st.fg; g.globalAlpha = .7; g.fillRect(x, y + h - 5, w, 5); g.globalAlpha = 1; }
  const t = setFont(g, st, s.name, w - 44, st.font === 'script' ? 38 : 42);
  g.shadowColor = st.fg; g.shadowBlur = 4; g.fillStyle = st.fg; g.fillText(t, x + w / 2, y + h / 2 + (st.font === 'script' ? 3 : 1)); g.shadowBlur = 0;
}

// консольная табличка поперёк коридора: ячейка 256×128, название в 1–2 строки
export function drawBlade(g, x, y, w, h, s, st) {
  g.fillStyle = st.shape === 'letters' ? st.bg : st.bg; rr(g, x + 2, y + 2, w - 4, h - 4, 14); g.fill();
  g.strokeStyle = st.fg; g.globalAlpha = .55; g.lineWidth = 3; rr(g, x + 9, y + 9, w - 18, h - 18, 9); g.stroke(); g.globalAlpha = 1;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = st.fg;
  const words = s.name.split(/\s+/); let lines = [s.name];
  if (words.length > 1 && s.name.length > 9) { let best = null; for (let k = 1; k < words.length; k++) { const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '); const m = Math.max(a.length, b.length); if (!best || m < best[0]) best = [m, a, b]; } lines = [best[1], best[2]]; }
  if (lines.length === 1) { const t = setFont(g, st, lines[0], w - 34, 56); g.fillText(t, x + w / 2, y + h / 2 + 2); }
  else { let px = 44; const fit = lines.map(l => { const t = setFont(g, st, l, w - 34, px); px = Math.min(px, parseInt(g.font.match(/(\d+)px/)[1])); return t; });
    const [fam, wt] = FONTS[st.font]; g.font = `${wt} ${px}px "${fam}", Manrope, system-ui, sans-serif`; fit.forEach((t, i) => g.fillText(t, x + w / 2, y + h / 2 + (i - 0.5) * px * 1.05)); }
}
