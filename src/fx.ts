export const LFX_HOME = 'https://www.lfx.com.la/';
// Public source used by the recommended-rate widget embedded on the LFX home page.
export const LFX_DATA_URL = 'https://opensheet.elk.sh/1eZzb1MsF2CKsReLPX4bv7Ph7jcLhMnyxakdOysLrwAw/Final';
export type LfxQuote = {
  provider: 'lfx'; base_currency: 'USD'; quote_currency: 'LAK'; kind: 'recommended';
  lak_per_usd: string; time_window: '15:00-16:00'; timezone: 'Asia/Vientiane';
  published_date: null; source_url: string; data_url: string; raw_row: Record<string,unknown>;
};
export type StoredRate = Omit<LfxQuote,'data_url'> & {
  id: string; fetched_at: Date | string | null; provided_at: Date | string | null;
  provenance:'lfx_fetch' | 'user_provided'; evidence: string | null; data_url:string | null;
};

export function validateDecimal(rate: string): { units: bigint; scale: bigint } {
  if (typeof rate !== 'string' || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(rate)) throw new Error('Invalid exchange rate');
  const [whole,frac = ''] = rate.split('.');
  const units = BigInt(whole+frac);
  if (units <= 0n) throw new Error('Invalid exchange rate');
  return { units,scale:10n**BigInt(frac.length) };
}
export function selectLfxUsdRate(input: unknown): LfxQuote {
  if (!Array.isArray(input)) throw new Error('Invalid LFX response');
  const matches = input.filter(row => row && typeof row.Time === 'string' && typeof row.Label === 'string' &&
    row.Time.replace(/\s/g,'').replace(/[–—]/g,'-') === '15:00-16:00' && row.Label.trim().toUpperCase() === 'USD');
  if (matches.length !== 1) throw new Error('Missing or ambiguous LFX USD 15:00–16:00 quote');
  const row = matches[0];
  if (typeof row.Price !== 'string' || !/^(?:(?:0|[1-9]\d{0,8})|[1-9]\d{0,2}(?:,\d{3}){1,2})(?:\.\d{1,6})?$/.test(row.Price.trim())) throw new Error('Invalid LFX price');
  const rate = row.Price.trim().replace(/,/g,'');
  validateDecimal(rate);
  return { provider:'lfx',base_currency:'USD',quote_currency:'LAK',kind:'recommended',lak_per_usd:rate,
    time_window:'15:00-16:00',timezone:'Asia/Vientiane',published_date:null,
    source_url:LFX_HOME,data_url:LFX_DATA_URL,raw_row:row };
}
export function lakToUsd(lak: number, rate: string): string {
  if (!Number.isSafeInteger(lak) || lak < 0) throw new Error('Invalid LAK amount');
  const { units,scale } = validateDecimal(rate);
  const numerator = BigInt(lak)*scale*100n;
  const cents = (numerator*2n+units)/(units*2n);
  return `${cents/100n}.${(cents%100n).toString().padStart(2,'0')}`;
}
export async function fetchLfxRate(signal: AbortSignal): Promise<LfxQuote> {
  const response = await fetch(LFX_DATA_URL,{ signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]) });
  if (!response.ok) throw new Error(`LFX data HTTP ${response.status}`);
  return selectLfxUsdRate(await response.json());
}
export function rateMetadata(rate: StoredRate | null, now = new Date()) {
  if (!rate) return null;
  const { raw_row,...metadata } = rate;
  return { ...metadata, retrieval_age_seconds:rate.fetched_at === null ? null : Math.max(0,Math.floor((now.getTime()-new Date(rate.fetched_at).getTime())/1000)),
    provided_age_seconds:rate.provided_at === null ? null : Math.max(0,Math.floor((now.getTime()-new Date(rate.provided_at).getTime())/1000)),
    publication_date_known:false };
}
