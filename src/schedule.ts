export const SYNC_TIMEZONE = 'Asia/Vientiane';
export const SYNC_WINDOW = '15:00-16:00';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SYNC_TIMEZONE, year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
});
function localParts(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid timestamp');
  return Object.fromEntries(formatter.formatToParts(now).map(p => [p.type,p.value]));
}
export function windowBounds(now: Date) {
  const p = localParts(now);
  const date = `${p.year}-${p.month}-${p.day}`;
  return { open: new Date(`${date}T15:00:00+07:00`), close: new Date(`${date}T16:00:00+07:00`) };
}
export function inSyncWindow(now: Date) {
  const { open,close } = windowBounds(now);
  return now >= open && now < close;
}
export function requireSyncWindow(now = new Date()) {
  if (!inSyncWindow(now)) throw new Error(`Live ingestion allowed only ${SYNC_WINDOW} ${SYNC_TIMEZONE}`);
}
export function nextOpening(now: Date): Date {
  const { open } = windowBounds(now);
  return now < open ? open : new Date(open.getTime()+86400000);
}
export function workerDelay(now: Date, intervalMs: number): number {
  return inSyncWindow(now) ? Math.min(intervalMs,windowBounds(now).close.getTime()-now.getTime()) : nextOpening(now).getTime()-now.getTime();
}
export function ingestionSignal(now: Date, parent?: AbortSignal) {
  requireSyncWindow(now);
  const deadline = AbortSignal.timeout(Math.max(1,windowBounds(now).close.getTime()-now.getTime()));
  return parent ? AbortSignal.any([deadline,parent]) : deadline;
}
