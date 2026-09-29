// Корзина: товары из разных магазинов ТРЦ. Хранится в браузере посетителя.
const KEY = 'maxi-cart';
let items = [];
try { items = JSON.parse(localStorage.getItem(KEY) || '[]') || []; if (!Array.isArray(items)) items = []; } catch (e) { items = []; }
const subs = [];
function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} subs.forEach(f => f()); }

export const cart = {
  items: () => items,
  count: () => items.reduce((a, x) => a + x.qty, 0),
  total: () => items.reduce((a, x) => a + x.qty * x.price, 0),
  add(it) {
    const ex = items.find(x => x.key === it.key);
    if (ex) ex.qty = Math.min(99, ex.qty + 1); else items.push(Object.assign({qty: 1}, it));
    save();
  },
  setQty(key, q) {
    const ex = items.find(x => x.key === key); if (!ex) return;
    if (q <= 0) items = items.filter(x => x.key !== key); else ex.qty = Math.min(99, q);
    save();
  },
  clear() { items = []; save(); },
  on(f) { subs.push(f); }
};
