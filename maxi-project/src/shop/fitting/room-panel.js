// Панель примерочной: список вещей, размеры, образы.
import {PREFS} from '../../core/settings.js';
import {sizeHint} from './body.js';
import {isWearable} from './classify.js';
import {LKEY, SLOT_T} from './common.js';
import {fitNote, recommendSize} from './sizes.js';
import {save} from './storage.js';
import {renderBodyControls} from './room-body-controls.js';
import {qcLine} from './room-playback.js';
import {el} from './room-scene.js';
import {W, add, has, persist, putOn, remove, takeOff, toItem, worn} from './room-wardrobe.js';
import {ctx} from './ui.js';
import {fit} from './state.js';
export let h;
let price;

  function itemRow(it, opts) {
    const li = h('li', 'fit-it' + (W.worn.includes(it.id) ? ' on' : ''));
    const img = h('img'); img.src = it.thumb; img.alt = ''; img.loading = 'lazy'; li.appendChild(img);
    const t = h('div', 'fit-t'); t.appendChild(h('b', '', it.name));
    const meta = h('small'); const dot = h('i'); dot.style.background = it.shopCol; meta.appendChild(dot); meta.appendChild(document.createTextNode(it.shop + (price(it) ? ' · ' + price(it) : '') + ' · ' + SLOT_T[it.slot].toLowerCase())); t.appendChild(meta); li.appendChild(t);
    const bx = h('div', 'fit-b');
    if (opts && opts.take) { const b = h('button', 'btn pri', 'Примерить'); b.onclick = () => { add(opts.p, fit.shopNow, true); render(); }; bx.appendChild(b); }
    else {
      const on = W.worn.includes(it.id), b = h('button', on ? 'btn' : 'btn pri', on ? 'Снять' : 'Надеть'); b.onclick = () => { on ? takeOff(it.id) : putOn(it.id); render(); }; bx.appendChild(b);
      if (it.url) { const a = h('a', 'btn', 'На сайт ↗'); a.href = it.url; a.target = '_blank'; a.rel = 'noopener'; bx.appendChild(a); }
      const x = h('button', 'btn fit-del', '×'); x.title = 'Убрать из примерочной'; x.setAttribute('aria-label', 'Убрать «' + it.name + '» из примерочной'); x.onclick = () => { remove(it.id); render(); }; bx.appendChild(x);
    }
    li.appendChild(bx); return li;
  }
  function renderItems(body) {
    const wn = worn();
    const top = h('div', 'fit-worn'); top.appendChild(h('div', 'sh-lab', 'Сейчас на фигуре'));
    if (!wn.length) top.appendChild(h('p', 'sh-note', 'Пока ничего. Нажми «Надеть» у вещи ниже.'));
    else { const chips = h('div', 'fit-chips'); wn.forEach(it => { const c = h('button', 'chip on'); const i = h('i'); i.style.background = it.color; c.appendChild(i); c.appendChild(document.createTextNode(it.name + ' ×')); c.title = 'Снять'; c.onclick = () => { takeOff(it.id); render(); }; chips.appendChild(c); }); top.appendChild(chips);
      // состояния вещи: расстёгнута / капюшон / заправлен — одна и та же вещь носится по-разному
      wn.filter(it => it.states && it.states.length > 1).forEach(it => {
        const row = h('div', 'fit-states'); row.appendChild(h('small', '', it.name + ':'));
        it.states.forEach(([key, label]) => { const b = h('button', 'sh-tab' + ((it.state || it.states[0][0]) === key ? ' on' : ''), label); b.onclick = () => { it.state = key; persist(); render(); }; row.appendChild(b); });
        top.appendChild(row); });
      // размер по таблице магазина: подбор по фигуре и подсказка, как сядет
      wn.filter(it => it.sizesT && it.sizesT.length).forEach(it => {
        const b = PREFS.body, rec = recommendSize(it, b), cur = it.size || rec;
        const row = h('div', 'fit-states'); row.appendChild(h('small', '', 'Размер · ' + it.name + ':'));
        it.sizesT.forEach(z => { const bt = h('button', 'sh-tab' + (z.name === cur ? ' on' : ''), z.name + (z.name === rec ? ' ✓' : '')); bt.title = (z.ru ? 'RU ' + z.ru : '') + (z.name === rec ? ' · подходит по фигуре' : ''); bt.onclick = () => { it.size = z.name === rec ? null : z.name; persist(); render(); }; row.appendChild(bt); });
        top.appendChild(row);
        const note = fitNote(it, b); if (note) top.appendChild(h('p', 'sh-note', note + (it.note ? ' (' + it.note + ')' : '')));
        const qe = h('p', 'sh-note'); qe.dataset.qc = it.id; top.appendChild(qe); qcLine(qe);
      });
      const sum = wn.reduce((a, it) => a + (it.price || 0), 0); if (sum) top.appendChild(h('p', 'sh-note', 'Образ целиком: ' + ctx.fmtPrice(sum) + ' · вещи из ' + new Set(wn.map(i => i.shop)).size + ' магаз.')); }
    body.appendChild(top);
    // вещи из всех магазинов
    body.appendChild(h('div', 'sh-lab', 'Взятые вещи · ' + W.items.length));
    if (!W.items.length) body.appendChild(h('p', 'sh-note', 'Здесь собираются вещи из всех магазинов. В карточке вещи нажимай «В примерочную» — и примеряй вещи из разных магазинов вместе.'));
    else { const byShop = {}; W.items.forEach(it => (byShop[it.shop] = byShop[it.shop] || []).push(it)); const ul = h('ul', 'fit-list');
      Object.entries(byShop).forEach(([shop, arr]) => { ul.appendChild(h('li', 'fit-shop', shop)); arr.forEach(it => ul.appendChild(itemRow(it))); }); body.appendChild(ul); }
    // вещи этого магазина — можно сразу примерить
    if (fit.shopNow) {
      const cat = ctx.catalogOf(fit.shopNow) || [], pool = [];
      cat.forEach(dep => { const n = Math.min(dep.items.length, 8); for (let i = 0; i < n; i++) { const p = dep.items[i]; if (isWearable(p) && !has(p, fit.shopNow)) pool.push(p); } });
      if (pool.length) { body.appendChild(h('div', 'sh-lab', 'Из «' + fit.shopNow.name + '» · примерить сразу')); const ul = h('ul', 'fit-list');
        pool.slice(0, 24).forEach(p => { const it = toItem(p, fit.shopNow); ul.appendChild(itemRow(it, {take: true, p})); }); body.appendChild(ul); }
    }
  }
  function renderBody(body) {
    const sz = sizeHint(PREFS.body);
    body.appendChild(h('p', 'sh-note', 'Ориентир размера по обхватам: верх ' + sz.top + ', низ ' + sz.bottom + '. Сверяй с таблицей размеров на сайте магазина.'));
    renderBodyControls(body);
  }
  function renderLooks(body) {
    const wn = worn();
    const sv = h('button', 'btn pri sh-more', 'Сохранить образ' + (wn.length ? ' (' + wn.length + ' вещ.)' : '')); sv.disabled = !wn.length;
    sv.onclick = () => { fit.looks.unshift({name: 'Образ ' + (fit.looks.length + 1), ids: W.worn.slice(), at: Date.now()}); fit.looks = fit.looks.slice(0, 20); save(LKEY, fit.looks); render(); };
    body.appendChild(sv);
    if (!fit.looks.length) { body.appendChild(h('p', 'sh-note', 'Собери образ на фигуре и сохрани — потом его можно будет надеть снова одной кнопкой и открыть вещи на сайтах магазинов.')); return; }
    const ul = h('ul', 'fit-list');
    fit.looks.forEach((lk, i) => {
      const items = lk.ids.map(id => W.items.find(x => x.id === id)).filter(Boolean);
      const li = h('li', 'fit-look'); li.appendChild(h('b', '', lk.name)); li.appendChild(h('small', '', items.map(x => x.name).join(' · ') || 'вещи убраны из примерочной'));
      const sum = items.reduce((a, it) => a + (it.price || 0), 0); if (sum) li.appendChild(h('small', '', 'Всего ' + ctx.fmtPrice(sum)));
      const bx = h('div', 'fit-b');
      const on = h('button', 'btn pri', 'Надеть'); on.disabled = !items.length; on.onclick = () => { W.worn = []; items.forEach(it => putOn(it.id, true)); persist(); fit.tab = 'items'; render(); }; bx.appendChild(on);
      items.filter(it => it.url).slice(0, 4).forEach(it => { const a = h('a', 'btn', it.shop + ' ↗'); a.href = it.url; a.target = '_blank'; a.rel = 'noopener'; a.title = it.name; bx.appendChild(a); });
      const del = h('button', 'btn fit-del', '×'); del.setAttribute('aria-label', 'Удалить образ'); del.onclick = () => { fit.looks.splice(i, 1); save(LKEY, fit.looks); render(); }; bx.appendChild(del);
      li.appendChild(bx); ul.appendChild(li);
    });
    body.appendChild(ul);
  }
  export function render() {
    if (!fit.open) return;
    el('fitShop').textContent = fit.shopNow ? 'Примерочная · ' + fit.shopNow.name : 'Примерочная';
    document.querySelectorAll('#fitTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === fit.tab));
    const body = el('fitBody'); const st = body.scrollTop; body.innerHTML = '';
    if (fit.tab === 'items') renderItems(body); else if (fit.tab === 'body') renderBody(body); else renderLooks(body);
    body.scrollTop = st;
  }

// по порядку, при запуске
export function init() {

  // ---------- интерфейс ----------
  h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  price = it => it.price ? ctx.fmtPrice(it.price) : '';
}
