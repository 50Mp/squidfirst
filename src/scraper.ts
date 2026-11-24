import { SOURCE, validateSnapshot, type Snapshot } from './catalog.js';

const catalogUrl = new URL('/api/games/products', SOURCE);

export function parseJorjeeCatalog(input: unknown): Snapshot[] {
  const response = input as {success?:unknown;data?:unknown}|null;
  if (response?.success !== true || !Array.isArray(response.data)) throw new Error('Invalid JorJee catalog response');
  const gameIds = new Set<string>();
  return validateSnapshot(response.data.map(entry => {
    if (typeof entry?.id !== 'string' || gameIds.has(entry.id) ||
        typeof entry.name !== 'string' || !Array.isArray(entry.packages)) throw new Error('Invalid or duplicate JorJee game');
    gameIds.add(entry.id);
    const name = entry.name.trim();
    const legacy = name === 'Free Fire (TH)' || name === 'Mobile Legends: Bang Bang';
    return {
      game: name,
      source_game_id: entry.id,
      source_game_name: name,
      variant_id: legacy ? 'default' : entry.id,
      zone: /\(TH\)$/i.test(name) ? 'th' : 'unspecified',
      packages: entry.packages.map((pkg: {id?:unknown;name?:unknown;price?:unknown}|null) => ({
        source_package_id: pkg?.id, name: pkg?.name, price: pkg?.price, currency: 'LAK', note: '',
      })),
    };
  }));
}

export async function scrapeCatalog(signal?: AbortSignal, fetchCatalog: typeof fetch = fetch): Promise<Snapshot[]> {
  const timeout = AbortSignal.timeout(30000);
  const response = await fetchCatalog(catalogUrl, {signal: signal ? AbortSignal.any([signal, timeout]) : timeout, redirect:'error'});
  if (!response.ok) throw new Error(`JorJee catalog HTTP ${response.status}`);
  return parseJorjeeCatalog(await response.json());
}
