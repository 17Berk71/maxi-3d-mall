// Быстрая проверка в настоящем браузере: запусти `npm run dev` в одном терминале, затем `npm run check`.
// Открывает страницу с ?debug, ждёт загрузки, заходит в Спортмастер, открывает товар, выходит,
// сохраняет скриншоты в tools/test/out/ и падает, если на странице были ошибки.
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';

const PAGE_URL = process.env.MAXI_URL || 'http://localhost:5173/?debug';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, {recursive: true});

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 760}});
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(PAGE_URL);
await page.waitForFunction(() => window.__maxi && window.__maxi.loaded, null, {timeout: 60000});
await page.waitForTimeout(1500);
await page.screenshot({path: OUT + '1-gallery.png'});

// подойти к двери Спортмастера и шагнуть в проём
await page.evaluate(() => {
  const T = window.__maxi, d = T.S.find(s => s.name === 'Спортмастер Pro').door;
  T.player.x = d.c.x + d.n.x * 2.5; T.player.z = d.c.z + d.n.z * 2.5; T.player.yaw = Math.atan2(d.n.x, d.n.z);
});
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const T = window.__maxi, d = T.S.find(s => s.name === 'Спортмастер Pro').door;
  T.player.x = d.c.x - d.n.x * 0.3; T.player.z = d.c.z - d.n.z * 0.3;
});
await page.waitForFunction(() => window.__maxi.mode === 'store', null, {timeout: 20000});
await page.waitForTimeout(1500);
await page.screenshot({path: OUT + '2-shop.png'});

await page.evaluate(() => window.__maxi.openProduct(window.__maxi.SHOP.cat[1].items[0]));
await page.waitForTimeout(1500);
await page.screenshot({path: OUT + '3-product.png'});

await page.evaluate(() => window.__maxi.exitShop());
await page.waitForFunction(() => window.__maxi.mode === 'walk', null, {timeout: 10000});
await page.screenshot({path: OUT + '4-back.png'});

// телефон
const phone = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
phone.on('pageerror', e => errors.push('mobile: ' + e));
await phone.goto(PAGE_URL);
await phone.waitForFunction(() => window.__maxi && window.__maxi.loaded, null, {timeout: 60000});
await phone.waitForTimeout(1500);
await phone.screenshot({path: OUT + '5-mobile.png'});

await browser.close();
if (errors.length) { console.error('Ошибки на странице:\n' + errors.join('\n')); process.exit(1); }
console.log('OK — скриншоты в', OUT);
