// Проверка в настоящем браузере: запусти `npm run dev` в одном терминале, затем `npm run check`.
// Проходит основные сценарии (оба этажа, вид сверху, лифт, магазины, товар, корзина и заказ,
// телефон вертикально и горизонтально, режим без анимации), сохраняет скриншоты в tools/test/out/
// и падает, если на странице были ошибки или сценарий не сработал.
// Если Playwright не находит свой браузер, укажи путь: CHROME_PATH=/путь/к/chrome npm run check
import {chromium} from 'playwright';
import {mkdirSync, existsSync} from 'node:fs';

const PAGE_URL = process.env.MAXI_URL || 'http://localhost:5173/?debug';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, {recursive: true});

const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch(exe ? {executablePath: exe} : {});
const errors = [], fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); console.log((ok ? '  ✓ ' : '  ✗ ') + what); };

async function open(viewport, extra = {}, query = '') {
  const page = await browser.newPage(Object.assign({viewport, ignoreHTTPSErrors: true}, extra));
  const tag = viewport.width + '×' + viewport.height;
  page.on('pageerror', e => errors.push(tag + ': ' + e.message));
  // шрифт с Google Fonts может не загрузиться без интернета — это не ошибка приложения, есть запасной шрифт
  const external = u => /fonts\.(googleapis|gstatic)\.com/.test(u || '');
  page.on('console', m => { if (m.type() === 'error' && !external(m.location().url)) errors.push(tag + ': ' + m.text() + ' ' + (m.location().url || '')); });
  page.on('requestfailed', r => { if (external(r.url())) console.log('  (шрифт не загрузился: ' + r.failure().errorText + ')'); });
  await page.goto(PAGE_URL + query, {timeout: 120000});
  await page.waitForFunction(() => window.__maxi && window.__maxi.loaded, null, {timeout: 120000});
  await page.waitForTimeout(1200);
  return page;
}
// скриншот после того, как камера долетела
const shot = async (page, name) => { await page.waitForFunction(() => !window.__maxi.anim, null, {timeout: 30000}).catch(() => {}); await page.waitForTimeout(200); await page.screenshot({path: OUT + name + '.png'}); };
// встать перед дверью магазина (на его этаже) и шагнуть в проём
async function enter(page, name) {
  await page.evaluate(n => { const T = window.__maxi, s = T.S.find(x => x.name === n); T.walkToDoor(s); }, name);
  await page.waitForFunction(() => !window.__maxi.anim, null, {timeout: 30000});
  await page.waitForTimeout(1600);
  await page.evaluate(n => { const T = window.__maxi, d = T.S.find(x => x.name === n).door; T.player.x = d.c.x - d.n.x * 0.3; T.player.z = d.c.z - d.n.z * 0.3; }, name);
  await page.waitForFunction(() => window.__maxi.mode === 'store', null, {timeout: 20000});
  await page.waitForTimeout(1200);
}

console.log('Компьютер 1280×760');
const page = await open({width: 1280, height: 760});
await shot(page, '01-gallery-floor1');

await page.click('#bTop'); await page.waitForTimeout(1500);
await shot(page, '02-top-floor1');
await page.click('#bF2'); await page.waitForTimeout(800);
check(await page.evaluate(() => window.__maxi.floor === 2), 'кнопка «2 этаж» в виде сверху');
await shot(page, '03-top-floor2');
// нажать на коридор второго этажа — «Перейти сюда»
const tap = await page.evaluate(() => { const T = window.__maxi, c = T.cam; const V = c.position.constructor;
  for (let r = 0; r < 60; r++) for (let a = 0; a < 16; a++) { const x = T.topv.x + Math.cos(a / 16 * 6.28) * r * 2, z = T.topv.z + Math.sin(a / 16 * 6.28) * r * 2;
    if (T.isWalk(x, z) && !T.blocked(x, z)) { const v = new V(x, 9.2, z).project(c); if (Math.abs(v.x) < 0.8 && Math.abs(v.y) < 0.8) return {x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight}; } }
  return null; });
check(!!tap, 'нашлась точка коридора в виде сверху');
if (tap) {
  await page.evaluate(p => window.__maxi.topTap(p.x, p.y), tap);
  check(await page.isVisible('#goHere'), 'кнопка «Перейти сюда»');
  await shot(page, '04-top-gohere');
  await page.click('#goHere'); await page.waitForTimeout(1500);
  check(await page.evaluate(() => window.__maxi.mode === 'walk' && window.__maxi.floor === 2), 'переход в точку на втором этаже');
}
await shot(page, '05-gallery-floor2');

// лифт: подойти, панель откроется сама, поехать на первый этаж
await page.evaluate(() => { const T = window.__maxi, L = T.lifts[0]; T.setFloor(2); T.player.x = L.c.x + L.n.x * (L.HL + 1.8); T.player.z = L.c.z + L.n.z * (L.HL + 1.8); T.player.yaw = Math.atan2(L.n.x, L.n.z); T.player.pitch = 0; });
await page.waitForTimeout(1500);
check(await page.isVisible('#lift'), 'панель лифта у дверей');
await shot(page, '06-lift-panel');
await page.click('#liftB1');
await page.waitForFunction(() => window.__maxi.ride && window.__maxi.ride.phase === 2, null, {timeout: 20000});
await page.waitForTimeout(700);
await shot(page, '07-lift-ride');
await page.waitForFunction(() => !window.__maxi.ride, null, {timeout: 30000});
check(await page.evaluate(() => window.__maxi.floor === 1), 'лифт привёз на первый этаж');
await shot(page, '08-lift-arrived');

// эскалатор: встать на ленту на первом этаже — приехать на второй
await page.evaluate(() => { const T = window.__maxi; T.setFloor(1); T.goEscalator(T.escs[0]); });
await page.waitForFunction(() => window.__maxi.ride && window.__maxi.ride.kind === 'esc' && window.__maxi.ride.phase === 1, null, {timeout: 30000});
await page.waitForTimeout(2500);
await page.screenshot({path: OUT + '08b-escalator-ride.png'});
await page.waitForFunction(() => !window.__maxi.ride, null, {timeout: 40000});
check(await page.evaluate(() => window.__maxi.floor === 2), 'эскалатор поднял на второй этаж');
await shot(page, '08c-escalator-top');
await page.evaluate(() => window.__maxi.setFloor(1));
// карта: до всех дверей можно дойти, колонны не мешают
const audit = await page.evaluate(() => window.__maxi.auditMap());
check(audit[1].unreachableDoors.length === 0 && audit[2].unreachableDoors.length === 0, 'до всех дверей можно дойти (1 этаж: ' + audit[1].doors + ', 2 этаж: ' + audit[2].doors + ')');
console.log('  узкие места: 1 этаж — ' + audit[1].narrow + ', 2 этаж — ' + audit[2].narrow + '; колонн оставлено ' + audit.columns.kept);

// Спортмастер: товар, манекен, корзина
await enter(page, 'Спортмастер Pro');
await shot(page, '09-shop-sportmaster');
await page.evaluate(() => window.__maxi.openProduct(window.__maxi.SHOP.cat[1].items[0]));
await page.waitForTimeout(1200);
await page.click('#shop .sh-seg .sh-tab:nth-child(2)'); await page.waitForTimeout(800);
await page.click('#shop .sh-buy .btn.pri');
check(await page.evaluate(() => document.querySelector('#shop .sh-lab').textContent === 'Выбери размер'), 'без размера в корзину не кладётся');
await page.click('#shop .sh-size:nth-child(3)');
await page.click('#shop .sh-buy .btn.pri');
check(await page.evaluate(() => window.__maxi.cart.count() === 1), 'товар в корзине');
await shot(page, '10-product-mannequin');
await page.evaluate(() => window.__maxi.exitShop());
await page.waitForFunction(() => window.__maxi.mode === 'walk', null, {timeout: 10000});
await shot(page, '11-back-to-gallery');

// второй этаж: кинотеатр и фуд-корт
await enter(page, 'Синема Парк');
check(await page.evaluate(() => window.__maxi.floor === 2), 'кинотеатр на втором этаже');
await shot(page, '12-cinema');
await page.evaluate(() => window.__maxi.openProduct(window.__maxi.SHOP.cat[0].items[0]));
await page.waitForTimeout(900);
await page.click('#shop .sh-buy .btn.pri');
await page.evaluate(() => window.__maxi.exitShop());
await enter(page, 'Бургер Кинг');
await shot(page, '13-foodcourt-cafe');
await page.evaluate(() => window.__maxi.exitShop());

// корзина и заказ
await page.click('#bCart'); await page.waitForTimeout(400);
await shot(page, '14-cart');
await page.click('#cartGo');
await page.click('#orderForm button[type=submit]');
check(await page.evaluate(() => document.getElementById('oErr').textContent.length > 0), 'пустая форма заказа не отправляется');
await page.fill('#oName', 'Анна'); await page.fill('#oPhone', '+7 900 123-45-67');
await page.click('#orderForm button[type=submit]');
check(await page.isVisible('#orderDone'), 'заказ оформлен');
check(await page.evaluate(() => window.__maxi.cart.count() === 0), 'корзина очистилась после заказа');
await shot(page, '15-order-done');
await page.click('#orderOk');
await page.close();

console.log('Без анимации');
const calm = await open({width: 1280, height: 760}, {reducedMotion: 'reduce'});
check(await calm.evaluate(() => window.__maxi.calm), 'включается из системной настройки');
await calm.evaluate(() => { const T = window.__maxi, L = T.lifts[1]; T.player.x = L.c.x + L.n.x * (L.HL + 1.8); T.player.z = L.c.z + L.n.z * (L.HL + 1.8); T.startRide(L, 2); });
check(await calm.evaluate(() => window.__maxi.floor === 2 && !window.__maxi.ride), 'лифт сразу, без поездки');
await calm.click('#bInfo'); await calm.waitForTimeout(300);
await shot(calm, '16-calm-info');
await calm.close();

console.log('Телефон вертикально 390×844');
const phone = await open({width: 390, height: 844}, {isMobile: true, hasTouch: true, deviceScaleFactor: 2});
await shot(phone, '17-phone-portrait');
await phone.tap('#bF2'); await phone.waitForTimeout(1500);
check(await phone.evaluate(() => window.__maxi.floor === 2), 'этаж переключается на телефоне');
await shot(phone, '18-phone-floor2');
await enter(phone, 'ДНС');
await phone.evaluate(() => window.__maxi.openProduct(window.__maxi.SHOP.cat[1].items[0]));
await phone.waitForTimeout(1000);
await shot(phone, '19-phone-product');
await phone.evaluate(() => window.__maxi.exitShop());
await phone.tap('#bTop'); await phone.waitForTimeout(1500);
await shot(phone, '20-phone-top');
await phone.close();

console.log('Телефон горизонтально 844×390');
const land = await open({width: 844, height: 390}, {isMobile: true, hasTouch: true, deviceScaleFactor: 2});
await shot(land, '21-phone-landscape');
await land.evaluate(() => { const T = window.__maxi, L = T.lifts[0]; T.player.x = L.c.x + L.n.x * (L.HL + 1.8); T.player.z = L.c.z + L.n.z * (L.HL + 1.8); T.player.yaw = Math.atan2(L.n.x, L.n.z); });
await land.waitForTimeout(1200);
check(await land.isVisible('#lift'), 'панель лифта в горизонтальном режиме');
await shot(land, '22-phone-landscape-lift');
await enter(land, 'Спортмастер Pro');
await land.evaluate(() => window.__maxi.openProduct(window.__maxi.SHOP.cat[0].items[0]));
await land.waitForTimeout(1000);
await shot(land, '23-phone-landscape-product');
await land.close();

await browser.close();
if (errors.length) console.error('Ошибки на странице:\n' + errors.join('\n'));
if (fails.length) console.error('Не сработало:\n' + fails.join('\n'));
if (errors.length || fails.length) process.exit(1);
console.log('OK — скриншоты в', OUT);
