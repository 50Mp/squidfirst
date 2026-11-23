import { chromium } from 'playwright';
import { GAMES, parsePackageText, validateSnapshot, type Snapshot } from './catalog.js';
import { attachBrowserAbort } from './browser-signal.js';

const HOME = 'https://www.ggxgstore.com/';
const CARD = 'div.relative.border.rounded-xl.p-2.w-full';

export function zoneFromName(name: string): string {
  if (/philippines/i.test(name)) return 'philippines';
  if (/malaysia/i.test(name)) return 'malaysia';
  if (/singapore/i.test(name)) return 'singapore';
  if (/russia|ລັດເຊຍ/i.test(name)) return 'russia';
  if (/indonesia|\bindo\b|ອີນໂດ/i.test(name)) return 'indonesia';
  if (/\bTH\b|thailand/i.test(name)) return 'th';
  return 'unspecified';
}

export async function scrapeGgxg(signal?: AbortSignal): Promise<Snapshot[]> {
  signal?.throwIfAborted();
  const browser = await chromium.launch();
  const detachAbort = await attachBrowserAbort(browser,signal);
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(30000);
  try {
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });
    await page.locator('a[href="/game/so-mobilelegends"]').first().waitFor({ state: 'attached' });
    const links = await page.locator('a[href]').evaluateAll(anchors => {
      const found = new Map<string, { url: string; name: string }>();
      for (const a of anchors) {
        const img = a.querySelector('img');
        const name = img?.getAttribute('alt')?.trim();
        const url = new URL(a.getAttribute('href')!, location.origin);
        if (name && /^(?:Mobile Legends\b|Free\s*Fire(?:\s*\(|$))/i.test(name) && url.origin === location.origin && url.pathname.startsWith('/game/')) {
          found.set(url.href, { url: url.href, name });
        }
      }
      return [...found.values()];
    });
    if (!links.some(l => /^Mobile Legends/i.test(l.name)) || !links.some(l => /^Free\s*Fire/i.test(l.name))) throw new Error('GGXG game links missing');
    console.log(`GGXG: discovered ${links.length} game variants (all listed zones)`);
    const snapshot: Snapshot[] = [];
    for (const link of links) {
      signal?.throwIfAborted();
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.goto(link.url, { waitUntil: 'domcontentloaded' });
          await page.locator(`${CARD} .text-lg.font-bold.text-orange-500`).first().waitFor();
          const rows = await page.locator(CARD).evaluateAll(cards => cards.map(card => ({
            name: card.querySelector('img[alt]')?.getAttribute('alt')?.trim() ?? '',
            note: (card.querySelector('.text-xs.mb-2') as HTMLElement | null)?.innerText.trim() ?? '',
            price: (card.querySelector('.text-lg.font-bold.text-orange-500') as HTMLElement | null)?.innerText.trim() ?? '',
          })));
          if (rows.length === 0 || rows.some(r => !r.name || !r.price)) throw new Error('Incomplete GGXG package cards');
          const packages = rows.map(r => ({ ...parsePackageText(`${r.name}\n${r.price}`), note: r.note }));
          snapshot.push({
            game: /^Mobile Legends/i.test(link.name) ? GAMES[0].name : GAMES[1].name,
            variant_id: decodeURIComponent(new URL(link.url).pathname), zone: zoneFromName(link.name),
            source_game_name: link.name, source_url: link.url, packages,
          });
          console.log(`GGXG: ${link.name}: ${packages.length} packages`);
          lastError = undefined; break;
        } catch (error) {
          signal?.throwIfAborted();
          lastError = error;
          console.error(`GGXG ${link.name} attempt ${attempt + 1}/3 failed:`, error instanceof Error ? error.message : error);
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
        }
      }
      if (lastError) throw new Error(`Failed to scrape GGXG variant ${link.name}`, { cause: lastError });
      await page.waitForTimeout(500);
    }
    return validateSnapshot(snapshot);
  } finally { detachAbort(); await browser.close(); }
}
