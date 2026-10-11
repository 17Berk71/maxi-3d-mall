// Кэш рассчитанной ткани: в памяти и в IndexedDB браузера.

// кэш: в памяти (последние 40) и в IndexedDB браузера (последние 300, ~50 КБ каждый)
const MEMC = new Map();
let IDB = null;
function idb() {
  if (IDB) return IDB;
  IDB = new Promise(res => { try { const r = indexedDB.open('maxi-fit', 1); r.onupgradeneeded = () => r.result.createObjectStore('drape'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } });
  return IDB;
}
export async function cacheGet(key) {
  if (MEMC.has(key)) return MEMC.get(key);
  const db = await idb(); if (!db) return null;
  return new Promise(res => { try { const q = db.transaction('drape').objectStore('drape').get(key); q.onsuccess = () => { const v = q.result; if (v && v.p) { MEMC.set(key, v.p); res(v.p); } else res(null); }; q.onerror = () => res(null); } catch (e) { res(null); } });
}
export async function cachePut(key, P) {
  MEMC.set(key, P); if (MEMC.size > 40) MEMC.delete(MEMC.keys().next().value);
  const db = await idb(); if (!db) return;
  try { const tx = db.transaction('drape', 'readwrite'), st = tx.objectStore('drape'); st.put({p: P, t: Date.now()}, key);
    // изредка чистим: оставляем 300 самых свежих
    if (Math.random() < 0.1) { const all = st.getAll(), keys = st.getAllKeys(); tx.oncomplete = null;
      keys.onsuccess = () => { all.onsuccess = () => { const L = keys.result.map((k, i) => [k, all.result[i].t]).sort((a, b) => b[1] - a[1]); if (L.length > 300) { const t2 = db.transaction('drape', 'readwrite').objectStore('drape'); L.slice(300).forEach(([k]) => t2.delete(k)); } }; }; } } catch (e) {}
}
