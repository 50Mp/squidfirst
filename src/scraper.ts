import { chromium, type Page } from 'playwright';
import { GAMES, SOURCE, parsePackageText, validateSnapshot, type Snapshot } from './catalog.js';
import { attachBrowserAbort } from './browser-signal.js';

export async function loadCatalogHome(page: Pick<Page, 'waitForResponse' | 'goto'>) {
  const [catalogReady] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/games/products') && r.status() === 200),
    page.goto(SOURCE, { waitUntil: 'domcontentloaded' }),
  ]);
  await catalogReady.finished();
}

export async function scrapeCatalog(signal?: AbortSignal): Promise<Snapshot[]> {
  signal?.throwIfAborted();
  const browser = await chromium.launch({ headless: true });
  const detachAbort = await attachBrowserAbort(browser,signal);
  const snapshot: Snapshot[] = [];
  try {
    for (const game of GAMES) {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        signal?.throwIfAborted();
        const context = await browser.newContext();
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        page.setDefaultNavigationTimeout(30000);
        try {
          await loadCatalogHome(page);
          await page.waitForFunction(() => (window as any).$nuxt?._isMounted === true);
          const sourceName = game.id === 'free-fire' ? 'Free Fire (TH)' : game.name;
          await page.getByAltText(sourceName, { exact: true }).first().click();
          await page.waitForURL(url => url.pathname === '/prepay/', { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(name => {
            const main = document.querySelector('main');
            const cards = [...document.querySelectorAll('.package-card-content')];
            return main?.innerText.trim().startsWith(name) && cards.length > 0 && cards.every(c => c.querySelector('.package-name')?.textContent?.trim() && c.querySelector('.price-amount')?.textContent?.trim());
          }, sourceName);
          const texts = await page.locator('.package-card-content').allInnerTexts();
          snapshot.push({ game: game.name, variant_id: 'default', zone: game.id === 'free-fire' ? 'th' : 'unspecified', source_game_name: sourceName, source_url: SOURCE, packages: texts.map(parsePackageText) });
          lastError = undefined;
          break;
        } catch (error) {
          signal?.throwIfAborted();
          console.error(`Scrape attempt ${attempt + 1}/3 failed for ${game.name} at ${new URL(page.url()).pathname}:`, error instanceof Error ? error.message : error);
          lastError = error;
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
        } finally { await context.close(); }
      }
      if (lastError) throw new Error(`Failed to scrape ${game.name}`, { cause: lastError });
    }
    return validateSnapshot(snapshot);
  } finally { detachAbort(); await browser.close(); }
}
