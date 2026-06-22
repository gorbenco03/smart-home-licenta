const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DC_HTML = '/Users/kirill/Desktop/Diagrame din specifications/Diagrame Licenta.dc.html';
const USECASE_HTML = path.join(__dirname, 'usecase.html');
const OUT = path.join(__dirname, 'png');

const IDS = [
  'fig-arhitectura', 'fig-flux-date', 'fig-er',
  'fig-secventa-monitorizare', 'fig-secventa-comanda', 'fig-secventa-alerta',
  'fig-ml-pipeline', 'fig-ml-isolation', 'fig-piramida-testare',
  'fig-eval-anomalii', 'fig-pinout', 'fig-mobile'
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2.5 });

  // 1) cardurile din fișierul exportat
  await page.goto('file://' + DC_HTML, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  for (const id of IDS) {
    const card = page.locator(`#${id} [data-card]`).first();
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: path.join(OUT, id + '.png') });
    console.log('  randat', id);
  }

  // 2) use-case reconstruit
  await page.goto('file://' + USECASE_HTML, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const uc = page.locator('[data-card]').first();
  await uc.screenshot({ path: path.join(OUT, 'fig-usecase.png') });
  console.log('  randat fig-usecase (reconstruit)');

  await browser.close();
})();
