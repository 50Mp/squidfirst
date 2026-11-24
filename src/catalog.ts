export const SOURCE = 'https://jorjeegamestore.com/';
export const SUPPLIER_GAMES = [
  { id: 'mobile-legends-bang-bang', name: 'Mobile Legends: Bang Bang', required_fields: ['UID', 'Zone ID'] },
  { id: 'free-fire', name: 'Free Fire', required_fields: ['UID'] },
] as const;
export const PUBG = { id: 'pubg-mobile', name: 'PUBG', required_fields: ['UID'] } as const;
export const GAMES = [...SUPPLIER_GAMES, PUBG] as const;
export type Package = { name: string; note: string; price: number; currency: 'LAK'; source_package_id?: string };
export const SOURCES = [
  { id: 'jorjee', name: 'JorJee Game Store', url: SOURCE },
  { id: 'ggxg', name: 'GGXG Store', url: 'https://www.ggxgstore.com/' },
] as const;
export type Snapshot = { game: string; packages: Package[]; variant_id?: string; zone?: string; source_game_name?: string; source_url?: string; source_game_id?: string };

const jorjeeId = /^[a-f0-9]{24}$/;
const canonicalGameName = (name: string) => name === 'Free Fire (TH)' ? 'Free Fire' : name.toLowerCase() === 'pubg mobile' ? 'PUBG' : name;
export function snapshotGameId(game: string, sourceGameId?: string) {
  return GAMES.find(entry => entry.name === game)?.id ?? (sourceGameId ? 'jorjee-'+sourceGameId : undefined);
}

export function parsePackageText(text: string): Package {
  const lines = text.split('\n').map(x => x.trim()).filter(Boolean);
  const priceLines = lines.filter(x => /\d.*ກີບ/.test(x));
  if (priceLines.length !== 1 || !/^(?:[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)\s+ກີບ$/.test(priceLines[0])) {
    throw new Error('Missing or invalid LAK price');
  }
  const price = Number(priceLines[0].replace(/\D/g, ''));
  const content = lines.filter(x => x !== priceLines[0]);
  if (!content[0] || !Number.isSafeInteger(price) || price <= 0) throw new Error('Invalid package');
  return { name: content[0], note: content.slice(1).join(' '), price, currency: 'LAK' };
}

export function validateSnapshot(input: unknown, sourceId = 'jorjee'): Snapshot[] {
  if (!Array.isArray(input) || input.length < SUPPLIER_GAMES.length || input.length > 200) throw new Error('Both games are required');
  for (const g of SUPPLIER_GAMES) if (!input.some(x => typeof x?.game === 'string' && canonicalGameName(x.game.trim()) === g.name)) throw new Error(`Missing game: ${g.name}`);
  const variants = new Set<string>();
  return input.map(variant => {
    if (typeof variant?.game !== 'string' || !variant.game.trim() || variant.game.length > 500) throw new Error('Invalid game name');
    const game = canonicalGameName(variant.game.trim().normalize('NFC'));
    const source_game_id = variant.source_game_id;
    if (source_game_id !== undefined && (sourceId !== 'jorjee' || typeof source_game_id !== 'string' || !jorjeeId.test(source_game_id))) throw new Error('Invalid source game ID');
    const gameId = snapshotGameId(game, source_game_id);
    if (!gameId) throw new Error('Unknown game');
    const variant_id = variant.variant_id ?? 'default';
    const zone = variant.zone ?? (variant.game === 'Free Fire (TH)' ? 'th' : 'unspecified');
    if (typeof variant_id !== 'string' || !variant_id || variant_id.length > 300 || typeof zone !== 'string' || !zone || zone.length > 100) throw new Error('Invalid variant/zone');
    const key = `${gameId}\0${variant_id}`;
    if (variants.has(key)) throw new Error('Duplicate game variant');
    variants.add(key);
    if (variant.source_game_name !== undefined && (typeof variant.source_game_name !== 'string' || variant.source_game_name.length > 500)) throw new Error('Invalid source name');
    if (variant.source_url !== undefined && (typeof variant.source_url !== 'string' || !/^https:\/\//.test(variant.source_url) || variant.source_url.length > 2000)) throw new Error('Invalid source URL');
    const packages = variant.packages;
    if (!Array.isArray(packages) || packages.length === 0 || packages.length > 1000) throw new Error('Empty or invalid packages');
    const packageKeys = new Set<string>();
    return { game, variant_id, zone, source_game_name: variant.source_game_name ?? variant.game, source_url: variant.source_url, source_game_id, packages: packages.map((p: any): Package => {
      if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 500 ||
          typeof p.note !== 'string' || p.note.length > 2000 || p.currency !== 'LAK' ||
          !Number.isSafeInteger(p.price) || p.price <= 0 || p.price > 2147483647) throw new Error('Invalid package data');
      const name = p.name.trim().normalize('NFC');
      const source_package_id = p.source_package_id;
      if (source_game_id && (typeof source_package_id !== 'string' || !jorjeeId.test(source_package_id))) throw new Error('Invalid source package ID');
      if (!source_game_id && source_package_id !== undefined) throw new Error('Source package ID requires a source game ID');
      const packageKey = source_package_id ?? name;
      if (packageKeys.has(packageKey)) throw new Error('Duplicate package identity');
      packageKeys.add(packageKey);
      return { name, note: p.note.trim(), price: p.price, currency: 'LAK', ...(source_package_id ? {source_package_id} : {}) };
    }) };
  });
}
