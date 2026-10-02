// Товары из выгрузок магазинов (готовит tools/feeds/import_feed.py → feeds/index.json и feeds/<магазин>.json).
// Если выгрузки у магазина нет или файлы недоступны, остаётся демо-каталог из catalog.js.
import {PHOTOS} from './photos.js';

export const FEED_BASE = 'feeds/';
let indexP = null;
const WIN = {};
export const winKeys = name => WIN[name] || [];
function loadIndex() {
  if (!indexP) indexP = fetch(FEED_BASE + 'index.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).catch(() => null).then(idx => {
    // несколько вещей на магазин — для витрин в галерее (они собираются сразу при запуске)
    if (idx && idx.shops) Object.entries(idx.shops).forEach(([name, e]) => {
      WIN[name] = (e.win || []).map((w, i) => { const k = 'win:' + name + ':' + i; PHOTOS[k] = {url: FEED_BASE + w.pic, aspect: w.aspect, h: w.h, color: w.color, colorName: '', items: []}; return k; });
    });
    return idx;
  });
  return indexP;
}
export function feedIndexReady() { return loadIndex(); }

// загрузить выгрузку магазина один раз; true — если у магазина появились товары из выгрузки
export async function loadFeed(s) {
  if (!s || s._feedTried) return !!(s && s._feed);
  if (s._feedP) return s._feedP;
  s._feedP = (async () => {
    const idx = await loadIndex(); const e = idx && idx.shops && idx.shops[s.name];
    if (!e) { s._feedTried = true; return false; }
    try {
      const r = await fetch(FEED_BASE + e.file, {cache: 'no-cache'}); if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      // фото с вырезанным фоном регистрируем как обычные фото товаров: дальше их вешает на вешала тот же код
      data.depts.forEach(d => d.items.forEach(it => {
        if (it.pic && it.cut) PHOTOS['feed:' + it.id] = {url: FEED_BASE + it.pic, aspect: it.aspect, h: it.h || 0.7, color: it.color, colorName: it.colorName, items: []};
      }));
      s._feed = data; s._cat = null; s._ph = null;
    } catch (err) { console.warn('выгрузка не загрузилась', s.name, err); }
    s._feedTried = true; return !!s._feed;
  })();
  return s._feedP;
}

// каталог магазина из выгрузки: отделы «для кого × тип», у каждого товара фото, размеры, ссылка
export function feedCatalog(s, DEPT) {
  const F = s._feed;
  return F.depts.filter(d => d.items.length).map(d => {
    const base = DEPT[d.type] || DEPT.generic;
    const items = d.items.map(it => ({
      name: it.name, price: it.price, oldPrice: it.oldPrice, color: it.color, colorName: it.colorName, icon: base.icon, dept: d.key, deptTitle: d.title,
      model: base.model, scale: d.who === 'kids' ? 0.72 : 1, photo: it.pic && it.cut ? 'feed:' + it.id : null, pic: it.pic ? FEED_BASE + it.pic : null,
      sizes: it.sizes, url: it.url, desc: it.desc || '', pickup: !!it.pickup, feed: true, id: 'f-' + it.id,
    }));
    // в зале мест больше, чем товаров в маленькой выгрузке, — товары повторяются по кругу
    return {key: d.key, title: d.title, icon: base.icon, model: base.model, lay: base.lay, items, itemAt(i) { return items[i % items.length]; }, feed: true};
  });
}
export const feedInfo = s => s && s._feed ? {updated: s._feed.updated, demo: !!s._feed.demo, source: s._feed.source || ''} : null;
