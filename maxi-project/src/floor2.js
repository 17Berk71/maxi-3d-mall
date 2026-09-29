// Второй этаж: раскладка помещений и арендаторы.
// Точной планировки второго этажа в открытых источниках нет, поэтому помещения повторяют контуры
// первого этажа (в ТРЦ этажи обычно стоят друг над другом), а галерея — это коридоры первого этажа
// без проёмов. Названия — настоящие арендаторы второго этажа по 2ГИС и сайту ТРЦ, места — примерные.
// Лифты — по официальной схеме ТРЦ (tools/pipeline/source/plan.png), пересчитаны в метры карты.

// Помещения в два этажа: над ними на втором этаже магазинов нет
const TALL = ['Садовый рай', 'Дом Лента'];
// Над Мисти Парком — кинотеатр
const CINEMA_UNDER = 'Мисти Парк';

// название, категория, чем торгуют, желаемая площадь (м²)
const TENANTS = [
  ['Фуд-корт', 'food', 'Бургер Кинг, Вкусно — и точка, Rostic\'s', 1400],
  ['Детский мир', 'kids', 'Детские товары, одежда и игрушки', 1300],
  ['Familia', 'fashion', 'Одежда, обувь и товары для дома', 1200],
  ['Домовой', 'home', 'Товары для дома', 1000],
  ['DNS', 'tech', 'Электроника и техника', 900],
  ['kari ГИПЕР', 'fashion', 'Обувь и аксессуары', 800],
  ["O'STIN", 'fashion', 'Одежда', 700],
  ['Технопарк', 'tech', 'Бытовая техника и электроника', 600],
  ['Леонардо', 'home', 'Товары для творчества и хобби', 500],
  ['Zenden', 'fashion', 'Обувь', 380],
  ['Vendi', 'fashion', 'Одежда', 350],
  ['FUNDAY', 'fashion', 'Одежда', 330],
  ['Velvet Season', 'fashion', 'Одежда', 300],
  ['kari KIDS', 'kids', 'Детская одежда и обувь', 280],
  ['Букварь', 'home', 'Книги и канцтовары', 260],
  ['URBERA', 'fashion', 'Одежда', 240],
  ['Империя сумок', 'acc', 'Сумки и кожгалантерея', 200],
  ['THOMAS MÜNZ', 'fashion', 'Обувь', 190],
  ['Ralf Ringer', 'fashion', 'Обувь', 170],
  ['Respect', 'fashion', 'Обувь', 160],
  ['CHESTER', 'fashion', 'Обувь и аксессуары', 150],
  ['Тофа', 'fashion', 'Обувь', 140],
  ['Лёгкий шаг', 'fashion', 'Обувь', 130],
  ['Prospect', 'fashion', 'Обувь и аксессуары', 120],
  ['Rieker', 'fashion', 'Обувь', 110],
  ['Incanto', 'acc', 'Украшения и часы', 90]
];

// Самая длинная сторона помещения, выходящая в галерею второго этажа (там будут двери)
function frontage(poly, isF) {
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 2.6) continue;
    const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const w1 = isF(mx - tz * 0.7, mz + tx * 0.7), w2 = isF(mx + tz * 0.7, mz - tx * 0.7);
    if (w1 !== w2 && L > best) best = L;
  }
  return best;
}

// Возвращает помещения второго этажа и контуры, над которыми второго этажа нет
export function floor2Of(D, isF2) {
  const out = [], tall = [];
  const cands = [];
  D.stores.forEach((s, i) => {
    if (TALL.includes(s.name)) { tall.push(s.poly); return; }
    const base = {kind: 'store', floor: 2, poly: s.poly, area: s.area, c: s.c, lp: s.lp, fit: s.fit, src: i};
    if (s.name === CINEMA_UNDER) {
      out.push(Object.assign(base, {name: 'Синема Парк', names: ['Синема Парк'], cat: 'kids', what: 'Кинотеатр: 8 залов, IMAX, KIDS и RELAX'}));
      return;
    }
    const f = frontage(s.poly, isF2);
    const o = Object.assign(base, {name: '', names: [], cat: 'tbd', what: ''});
    out.push(o);
    if (f >= 2.6 && s.area >= 60) cands.push(o);
  });
  const used = new Set();
  const cinema = out.find(o => o.name === 'Синема Парк');
  // фуд-корт — большое помещение ближе всего к кинотеатру
  const take = (o, t) => { used.add(o); o.name = t[0]; o.names = [t[0]]; o.cat = t[1]; o.what = t[2]; };
  const fc = TENANTS[0];
  if (cinema) {
    const big = cands.filter(o => o.area >= 600).sort((a, b) =>
      Math.hypot(a.c[0] - cinema.c[0], a.c[1] - cinema.c[1]) - Math.hypot(b.c[0] - cinema.c[0], b.c[1] - cinema.c[1]));
    if (big[0]) take(big[0], fc);
  }
  // остальные — по площади: ближайшее по размеру свободное помещение
  TENANTS.slice(1).forEach(t => {
    let best = null, bd = 1e9;
    cands.forEach(o => {
      if (used.has(o)) return;
      const d = Math.abs(Math.log(o.area / t[3]));
      if (d < bd - 1e-9) { bd = d; best = o; }
    });
    if (best) take(best, t);
  });
  return {stores: out, tall};
}

// Лифты по официальной схеме (центр значка, пересчитанный в метры карты)
export const LIFTS_PLAN = [[-39.6, -11.7], [117.3, 74.4]];
