// Гардероб примерочной: вещи, надетое, образы; добавить, надеть, снять.
import {classify} from './classify.js';
import {LKEY, WKEY} from './common.js';
import {load, save} from './storage.js';
import {ctx} from './ui.js';
import {fit} from './state.js';
export let W, subs, persist, has, worn;
let idOf;

  export function toItem(p, s) {
    const c = classify(p); if (!c) return null;
    return {id: idOf(p, s), name: p.name, shop: s ? s.name : '', shopCol: s ? s.colHex : '#888', price: p.price || 0, oldPrice: p.oldPrice || 0, url: p.url || (s && ctx.siteOf(s)) || '',
      color: p.color || '#888888', colorName: p.colorName || '', thumb: ctx.thumb(p), model: p.model, slot: c.slot, kind: c.kind, sizes: p.sizes || null, feed: !!p.feed, glb: p.glb || null,
      tex: p.tex || null, pack: p.fitPack || null, drape: p.drape || null, fit: p.fit || null, shape: p.shape || null, sizesT: p.sizesT || null, size: null, brand: p.brand || '', note: p.note || '', states: p.states || null, state: p.states ? p.states[0][0] : '', zip: !!p.zip, pleats: !!p.pleats, puff: !!p.puff, stand: !!p.stand, collar: !!p.collar, hood: !!p.hood, who: p.who || ''};
  }
  export function add(p, s, wear) {
    const it = toItem(p, s); if (!it) return false;
    if (!W.items.some(i => i.id === it.id)) W.items.unshift(it);
    if (W.items.length > 60) { const drop = W.items.pop(); W.worn = W.worn.filter(id => id !== drop.id); }
    if (wear) putOn(it.id, true);
    persist(); return true;
  }
  export function putOn(id, quiet) {
    const it = W.items.find(i => i.id === id); if (!it) return;
    const clash = sl => sl === it.slot || (it.slot === 'dress' && (sl === 'top' || sl === 'bottom')) || ((it.slot === 'top' || it.slot === 'bottom') && sl === 'dress');
    W.worn = W.worn.filter(w => { const o = W.items.find(i => i.id === w); return o && !clash(o.slot); });
    W.worn.push(id); if (!quiet) persist();
  }
  export function takeOff(id) { W.worn = W.worn.filter(w => w !== id); persist(); }
  export function remove(id) { W.items = W.items.filter(i => i.id !== id); W.worn = W.worn.filter(w => w !== id); persist(); }

// по порядку, при запуске
export function init() {
  // ctx: {fmtPrice, thumb(p) → url, siteOf(s), onOpen(), onClose(), coarse, catalogOf(s)}
  W = load(WKEY, {items: [], worn: []});
  fit.looks = load(LKEY, []);
  subs = [];
  persist = () => { save(WKEY, W); subs.forEach(f => f()); };
  idOf = (p, s) => p.feed && p.id ? p.id : (s ? s.name : '') + '|' + p.name + '|' + (p.color || '');
  has = (p, s) => W.items.some(i => i.id === idOf(p, s));
  worn = () => W.worn.map(id => W.items.find(i => i.id === id)).filter(Boolean);
}
