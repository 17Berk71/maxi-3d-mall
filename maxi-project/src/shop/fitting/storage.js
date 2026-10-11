// Гардероб в браузере: загрузка и сохранение.

// ---------- гардероб ----------
export function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || 'null') || def; } catch (e) { return def; } }
export function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
