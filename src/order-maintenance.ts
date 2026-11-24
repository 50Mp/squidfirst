import { setTimeout as delay } from 'node:timers/promises';
import type { OrderService } from './orders.js';

type ExpiryService = Pick<OrderService, 'expireAwaitingPayment'>;

export async function runOrderMaintenance(service: ExpiryService, signal: AbortSignal, intervalMs = 5000): Promise<void> {
 while (!signal.aborted) {
  try {
   await service.expireAwaitingPayment();
  } catch (error) {
   if (!signal.aborted) console.error('Order payment expiry sweep failed', error);
  }
  if (signal.aborted) break;
  try {
   await delay(intervalMs, undefined, { signal });
  } catch (error) {
   if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) break;
   throw error;
  }
 }
}
