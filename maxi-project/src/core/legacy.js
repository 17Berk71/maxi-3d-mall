// Старый режим: корзина, заказ и примерочная на манекене. С октября 2026 (PRD) они убраны из интерфейса,
// код остаётся. Включается адресом ?legacy (для сравнения и разработки); обычный посетитель его не видит.
export const LEGACY = (() => { try { return new URLSearchParams(location.search).has('legacy'); } catch (e) { return false; } })();
