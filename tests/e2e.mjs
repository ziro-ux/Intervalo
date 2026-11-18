// Testes de ponta a ponta do Intervalo. Rodam no GitHub Actions antes de publicar o site e o APK.
// Uso: node build.mjs && node tests/e2e.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  const file = path.join(dist, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
await new Promise(r => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;
const H = 3600e3;
let passed = 0, failed = 0;
const browser = await chromium.launch();

async function scenario(name, fn, { native = false, seed = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('https://world.openfoodfacts.org/api/v2/product/**', r => {
    const code = r.request().url().split('/product/')[1].split('.json')[0];
    if (code === '7891000100103') return r.fulfill({ json: { status: 1, product: { code, product_name: 'Biscoito Maria', brands: 'Marilan', serving_size: '30 g', serving_quantity: 30, nutriments: { 'energy-kcal_100g': 433, carbohydrates_100g: 73, proteins_100g: 8.3, fat_100g: 12, sodium_100g: 0.32 } } } });
    return r.fulfill({ status: 404, json: { status: 0 } });
  });
  await ctx.route(/openfoodfacts\.org\/(search|cgi)/, r => r.fulfill({ json: { hits: [], products: [] } }));
  await ctx.route('https://api.github.com/**', r => r.fulfill({ json: { tag_name: 'v0.0', assets: [] } }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(([native, seed]) => {
    if (native) {
      window.__t = { sched: [], exit: 0 };
      window.Capacitor = { isNativePlatform: () => true, Plugins: {
        App: { addListener: (n, f) => { window.__t.back = f; }, exitApp: () => { window.__t.exit++; } },
        LocalNotifications: { checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }),
          getPending: async () => ({ notifications: [] }), cancel: async () => {}, schedule: async o => { window.__t.sched = o.notifications; } } } };
    }
    if (seed && !localStorage.getItem('intervalo-v1')) localStorage.setItem('intervalo-v1', JSON.stringify(seed));
  }, [native, typeof seed === 'function' ? seed() : seed]);
  try {
    await page.goto(base);
    await page.waitForTimeout(700);
    await fn(page);
    assert.deepEqual(errors, [], 'erros na página: ' + errors.join(' | '));
    const shown = await page.evaluate(() => [...document.querySelectorAll('dialog')].filter(d => !d.open && getComputedStyle(d).display !== 'none').map(d => d.id));
    assert.deepEqual(shown, [], 'janela fechada aparecendo na página');
    console.log('  ok  ' + name); passed++;
  } catch (e) {
    console.log('  ERRO ' + name + '\n       ' + String(e.message).split('\n').slice(0, 4).join('\n       ')); failed++;
  }
  await ctx.close();
}
const day = k => { const d = new Date(Date.now() - k * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const S = p => p.evaluate(() => JSON.parse(JSON.stringify(state)));

console.log('Testes do Intervalo');

await scenario('primeiro uso guiado', async p => {
  assert.ok(await p.evaluate(() => document.getElementById('onboardDialog').open), 'introdução não abriu');
  await p.fill('#obName', 'Ana'); await p.click('#obNext'); await p.click('#obHours [data-h="14"]'); await p.click('#obNext');
  await p.fill('#obKg', '70'); await p.click('#obNext'); await p.waitForTimeout(400);
  const st = await S(p);
  assert.equal(st.profile.name, 'Ana'); assert.equal(st.hours, 14); assert.equal(st.onboarded, true); assert.equal(st.weights.length, 1);
});

const seeded = { version: 1, hours: 16, theme: 'dark', active: null, records: [], water: [], waterGoal: 0, notes: {}, onboarded: true };

await scenario('jejum: iniciar, 74h personalizado, sem meta, encerrar', async p => {
  await p.evaluate(() => showPage('today'));
  await p.click('#mainAction'); await p.waitForTimeout(300);
  await p.click('#changeDuration'); await p.click('#durChips [data-h=custom]'); await p.fill('#durH', '74'); await p.click('#durationForm .primary'); await p.waitForTimeout(300);
  let st = await S(p);
  assert.equal(st.active.hours, 74); assert.equal(st.active.custom, true);
  assert.match(await p.textContent('#planChip'), /74h/);
  await p.click('#changeDuration'); await p.click('#durChips [data-h=open]'); await p.click('#durationForm .primary'); await p.waitForTimeout(300);
  assert.equal(await p.textContent('#planChip'), 'Sem meta');
  await p.click('#mainAction'); await p.waitForTimeout(200); await p.click('#finishForm .primary'); await p.waitForTimeout(500);
  st = await S(p);
  assert.equal(st.active, null); assert.equal(st.records.length, 1); assert.equal(st.records[0].open, true);
}, { seed: seeded });

await scenario('sequência conta jejum longo em todos os dias cobertos', async p => {
  const info = await p.evaluate(() => { const s = streakInfo(); return { n: s.n, today: s.todayDone }; });
  assert.ok(info.n >= 3, 'sequência ' + info.n);
  await p.evaluate(() => showPage('history')); await p.waitForTimeout(200);
  const flowers = await p.$$eval('#garden .g-day', e => e.filter(x => /conta/.test(x.getAttribute('aria-label') || '')).length);
  assert.ok(flowers >= 3, 'flores ' + flowers);
}, { seed: () => ({ ...seeded, active: { id: 'a', start: Date.now() - 74 * H, hours: 16, open: true } }) });

await scenario('busca: nome legível, porção rápida, prato e só calorias', async p => {
  await p.evaluate(() => { prepareMeal(1); openCatalog(true); });
  await p.fill('#foodSearch', 'filé de frango grelhado'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#foodList .catalog-row strong'), /Peito de frango grelhado/);
  await p.click('#foodList .catalog-row .food-add'); await p.waitForTimeout(200);
  await p.click('#portionQuick button:nth-child(3)'); await p.click('#portionForm .primary'); await p.waitForTimeout(200);
  await p.fill('#foodSearch', 'arroz branco'); await p.waitForTimeout(300); await p.click('#foodList .catalog-row .food-add'); await p.waitForTimeout(200); await p.click('#portionForm .primary'); await p.waitForTimeout(200);
  await p.click('#saveDish'); await p.fill('#dishName', 'Almoço'); await p.click('#dishForm .primary'); await p.waitForTimeout(300);
  await p.click('#kcalOnly'); await p.fill('#kcalValue', '300'); await p.click('#kcalForm .primary'); await p.waitForTimeout(200);
  await p.click('#finishFoods'); await p.waitForTimeout(400);
  const st = await S(p);
  assert.equal(st.meals.length, 3); assert.equal(st.dishes.length, 1); assert.equal(st.meals[0].amount, 150);
  assert.ok(!st.foods.some(f => f.id.startsWith('kcal-')), 'só calorias entrou no catálogo');
}, { seed: seeded });

await scenario('código de barras: busca automática e valores completos', async p => {
  await p.evaluate(() => { prepareMeal(0); openCatalog(true); openScan(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => handleScannedCode('7891000100103')); await p.waitForTimeout(700);
  assert.match(await p.innerText('#scanProduct'), /Biscoito Maria/);
  await p.click('#scanProduct .primary'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#portionQuick'), /1 porção · 30 g/);
  const f = (await S(p)).foods.find(x => x.barcode === '7891000100103');
  assert.equal(f.sodium, 320); assert.equal(f.servingG, 30);
  assert.ok(await p.evaluate(() => !!window.ZXing), 'leitor não carregou');
}, { seed: seeded });

await scenario('peso e semana no histórico', async p => {
  await p.evaluate(() => showPage('history')); await p.click('#addWeight'); await p.fill('#weightKg', '72.4'); await p.click('#weightForm .primary'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#weightNow'), /72,4/);
  assert.equal(await p.$$eval('#wkGrid div', e => e.length), 6);
}, { seed: seeded });

await scenario('APK: lembretes, botão voltar e cópia automática', async p => {
  await p.evaluate(() => showPage('settings'));
  await p.check('#rFastEnd'); await p.waitForTimeout(700);
  assert.deepEqual(await p.evaluate(() => window.__t.sched.map(n => n.id)), [1001]);
  await p.evaluate(() => { prepareMeal(0); openCatalog(true); });
  await p.evaluate(() => window.__t.back()); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => document.getElementById('catalogDialog').open), false);
  await p.evaluate(() => window.__t.back()); await p.waitForTimeout(100);
  assert.equal(await p.evaluate(() => document.getElementById('page-home').hidden), false);
  await p.evaluate(() => window.__t.back());
  assert.equal(await p.evaluate(() => window.__t.exit), 1);
  await p.waitForTimeout(4500);
  const snaps = await p.evaluate(() => AB.list().then(l => l.length));
  assert.ok(snaps >= 1, 'sem cópia automática');
}, { native: true, seed: () => ({ ...seeded, active: { id: 'a', start: Date.now() - 2 * H, hours: 16 }, records: [{ id: 'r', start: Date.now() - 40 * H, end: Date.now() - 24 * H, hours: 16, note: '' }] }) });

await scenario('dados antigos e corrompidos carregam sem perder o resto', async p => {
  const st = await S(p);
  assert.equal(st.records.length, 1); assert.deepEqual(st.weights.map(w => w.day), [day(1)]);
}, { seed: () => ({ ...seeded, records: [{ id: 'r', start: Date.now() - 30 * H, end: Date.now() - 14 * H, hours: 16, note: '' }], weights: [{ id: 'a', day: day(1), kg: 70 }, { id: 'b', day: '2026-13-45', kg: 70 }] }) });

await browser.close(); server.close();
console.log(`\n${passed} ok, ${failed} com erro`);
process.exit(failed ? 1 : 0);
