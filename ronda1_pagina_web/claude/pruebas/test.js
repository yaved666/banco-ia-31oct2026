const path = require('path');
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const OUT = path.join(__dirname, 'capturas'); fs.mkdirSync(OUT, { recursive: true });
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const browser = await chromium.launch({ timeout: 60000 }); console.log('browser ok');
  for (const [w, h] of [[375, 812], [1440, 900]]) {
    console.log(`\n=== ${w}px ===`);
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [], external = [];
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) external.push(r.url()); });
    await page.goto(URL);
    await page.waitForLoadState('load');
    ok(errors.length === 0, 'sin errores de consola ' + JSON.stringify(errors));
    ok(external.length === 0, 'sin peticiones externas ' + JSON.stringify(external));
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= w, `sin scroll horizontal (scrollWidth=${sw})`);
    // elementos que sobresalen
    const over = await page.evaluate((w) => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > w + 1 || r.left < -1) && !e.closest('.sr-only,.skip-link'); }).map(e => e.tagName + '.' + e.className).slice(0, 5), w);
    ok(over.length === 0, 'ningún elemento fuera del viewport ' + JSON.stringify(over));
    ok(await page.locator('.services > li').count() >= 4, 'al menos 4 servicios');
    const prices = await page.locator('.product .price').allTextContents();
    ok(prices.length >= 3 && prices.every(p => /€/.test(p)), 'productos con precios: ' + prices.length);
    await page.screenshot({ path: path.join(OUT, `full-${w}.png`), fullPage: true });

    // axe
    await page.addScriptTag({ content: axeSrc });
    const res = await page.evaluate(async () => await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }));
    res.violations.forEach(v => console.log('  axe:', v.id, v.impact, v.nodes.length, v.nodes[0].target.join(' '), v.nodes[0].failureSummary.split('\n')[1]));
    ok(res.violations.length === 0, `axe sin violaciones (${res.violations.length})`);

    // menú móvil
    if (w === 375) {
      ok(!(await page.locator('.site-nav').isVisible()), 'menú cerrado inicialmente');
      await page.keyboard.press('Tab'); // skip link
      const skip = await page.evaluate(() => document.activeElement.className);
      ok(skip === 'skip-link', 'primer Tab = enlace "Saltar al contenido"');
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      ok(await page.evaluate(() => document.activeElement.classList.contains('nav-toggle')), 'Tab llega al botón de menú');
      await page.keyboard.press('Enter');
      ok(await page.locator('.site-nav').isVisible(), 'Enter abre el menú');
      await page.screenshot({ path: path.join(OUT, 'menu-375.png') });
      await page.keyboard.press('Escape');
      ok(!(await page.locator('.site-nav').isVisible()) && await page.evaluate(() => document.activeElement.classList.contains('nav-toggle')), 'Escape cierra y devuelve foco');
      await page.click('.nav-toggle'); await page.click('.site-nav a[href="#contacto"]');
      ok(!(await page.locator('.site-nav').isVisible()), 'elegir enlace cierra menú');
    } else {
      ok(await page.locator('.site-nav').isVisible() && !(await page.locator('.nav-toggle').isVisible()), 'nav visible y sin botón en escritorio');
    }
    await page.close();
  }

  // Formulario
  console.log('\n=== formulario ===');
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(URL);
  await page.click('button[type=submit]');
  ok(await page.locator('#form-summary').isVisible(), 'enviar vacío muestra resumen de errores');
  ok(await page.evaluate(() => document.activeElement.id) === 'form-summary', 'foco va al resumen de errores');
  await page.waitForTimeout(800);
  const vis = await page.evaluate(() => { const h = document.querySelector('.site-header').getBoundingClientRect().bottom; const r = document.getElementById('form-summary').getBoundingClientRect(); return { h, top: r.top }; });
  ok(vis.top >= vis.h && vis.top < 812, 'resumen visible bajo la cabecera ' + JSON.stringify(vis));
  await page.screenshot({ path: path.join(OUT, 'form-summary-375.png') });
  await page.click('#form-summary a[href="#mensaje"]');
  await page.waitForTimeout(800);
  const v2 = await page.evaluate(() => { const h = document.querySelector('.site-header').getBoundingClientRect().bottom; const l = document.querySelector('label[for=mensaje]').getBoundingClientRect(); return { active: document.activeElement.id, h, top: l.top }; });
  ok(v2.active === 'mensaje' && v2.top >= v2.h && v2.top < 812, 'enlace del resumen lleva al campo visible ' + JSON.stringify(v2));
  const invalid = await page.$$eval('[aria-invalid=true]', els => els.map(e => e.id));
  ok(JSON.stringify(invalid) === JSON.stringify(['nombre','email','motivo','mensaje','privacidad']), 'campos inválidos: ' + invalid);
  ok(!(await page.locator('#confirmation').isVisible()), 'no hay confirmación con errores');
  await page.screenshot({ path: path.join(OUT, 'form-errors-375.png'), fullPage: false });
  // casos inválidos concretos
  await page.fill('#nombre', 'A'); await page.locator('#nombre').blur();
  ok((await page.textContent('#nombre-error')).includes('2 caracteres'), 'nombre corto rechazado');
  await page.fill('#email', 'pepe@correo'); await page.locator('#email').blur();
  ok((await page.textContent('#email-error')).includes('no parece válido'), 'email sin dominio rechazado');
  await page.fill('#telefono', '12345'); await page.locator('#telefono').blur();
  ok((await page.textContent('#telefono-error')).length > 0, 'teléfono inválido rechazado');
  await page.fill('#mensaje', 'corto'); await page.locator('#mensaje').blur();
  ok((await page.textContent('#mensaje-error')).includes('corto'), 'mensaje corto rechazado');
  ok((await page.textContent('#mensaje-count')) === '5', 'contador de caracteres');
  // corregir solo con teclado
  await page.fill('#nombre', 'María José');
  await page.fill('#email', 'maria@correo.es');
  await page.fill('#telefono', '+34 612 345 678');
  await page.focus('#motivo'); await page.keyboard.press('ArrowDown');
  await page.fill('#mensaje', 'Necesito presupuesto para 20 m² de tarima.');
  await page.focus('#privacidad'); await page.keyboard.press('Space');
  ok((await page.$$('[aria-invalid=true]')).length === 0, 'errores desaparecen al corregir');
  await page.focus('button[type=submit]'); await page.keyboard.press('Enter');
  ok(await page.locator('#confirmation').isVisible(), 'envío válido muestra confirmación');
  ok(!(await page.locator('#contact-form').isVisible()), 'formulario oculto tras enviar');
  const txt = await page.textContent('#confirmation-text');
  ok(txt.includes('María') && txt.includes('maria@correo.es'), 'confirmación personalizada: ' + txt);
  ok(await page.evaluate(() => document.activeElement.id) === 'confirmation', 'foco en confirmación');
  await page.screenshot({ path: path.join(OUT, 'form-ok-375.png') });
  await page.click('#new-message');
  ok(await page.locator('#contact-form').isVisible() && (await page.inputValue('#nombre')) === '', '"Enviar otro" restablece el formulario');

  // horario
  const st = await page.evaluate(() => {
    const f = window.__ferreteria.openStatus;
    return [f(new Date(2026, 10, 2, 10, 0)), f(new Date(2026, 10, 2, 15, 0)), f(new Date(2026, 10, 7, 13, 59)), f(new Date(2026, 10, 1, 12, 0)), f(new Date(2026, 10, 2, 8, 0))].map(s => s.text);
  });
  console.log('  ', st);
  ok(st[0].startsWith('Abierto') && st[1].includes('17:00') && st[2].startsWith('Abierto') && st[3] === 'Cerrado ahora' && st[4].includes('9:00'), 'lógica abierto/cerrado');

  // Recorrido de teclado completo en escritorio
  const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p2.goto(URL);
  const seen = [];
  for (let i = 0; i < 40; i++) {
    await p2.keyboard.press('Tab');
    const d = await p2.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { t: a.tagName + (a.id ? '#' + a.id : '') + (a.textContent.trim() ? ' "' + a.textContent.trim().slice(0, 20) + '"' : ''), outline: cs.outlineStyle !== 'none' || cs.boxShadow !== 'none' }; });
    seen.push(d); if (d.t.startsWith('BUTTON') && d.t.includes('Enviar')) break;
  }
  console.log('  orden Tab:', seen.map(s => s.t).join(' → '));
  ok(seen.every(s => s.outline), 'todos los elementos enfocables muestran indicador de foco');
  ok(seen.some(s => s.t.includes('Enviar')), 'el formulario es alcanzable con Tab');
  await browser.close();
  console.log(`\n${fails ? fails + ' FALLOS' : 'TODO OK'}`);
  process.exit(fails ? 1 : 0);
})();
