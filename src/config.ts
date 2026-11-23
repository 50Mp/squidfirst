export function positiveInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`Expected integer between ${min} and ${max}`);
  return parsed;
}
export function intervalMs() { return positiveInteger(process.env.SYNC_INTERVAL_MINUTES, 15, 1, 10080) * 60000; }
