// Открыть и закрыть окно примерочной, кнопки.
import {render} from './room-panel.js';
import {frame, view} from './room-playback.js';
import {built, el, ensureScene} from './room-scene.js';
import {W} from './room-wardrobe.js';
import {ctx} from './ui.js';
import {fit} from './state.js';

  export function openRoom(s) {
    fit.shopNow = s || null; ensureScene(); fit.open = true; el('fitting').hidden = false; fit.tab = W.items.length || !fit.shopNow ? 'items' : 'items';
    built.key = ''; render(); cancelAnimationFrame(fit.raf); frame(); ctx.onOpen && ctx.onOpen();
  }
  export function closeRoom() { fit.open = false; cancelAnimationFrame(fit.raf); el('fitting').hidden = true; ctx.onClose && ctx.onClose(); }

// по порядку, при запуске
export function init() {

  // кнопки
  el('fitX').onclick = closeRoom;
  document.querySelectorAll('#fitTabs button').forEach(b => b.onclick = () => { fit.tab = b.dataset.t; render(); });
  document.querySelectorAll('#fitViews button').forEach(b => b.onclick = () => view(b.dataset.v));
  addEventListener('keydown', e => { if (fit.open && e.key === 'Escape') { e.stopPropagation(); closeRoom(); } }, true);
}
