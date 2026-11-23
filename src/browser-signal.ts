import type { Browser } from 'playwright';

export async function attachBrowserAbort(browser: Browser, signal?: AbortSignal): Promise<() => void> {
  if (!signal) return () => {};
  if (signal.aborted) { await browser.close(); signal.throwIfAborted(); }
  const close = () => { void browser.close().catch(() => {}); };
  signal.addEventListener('abort',close,{once:true});
  return () => signal.removeEventListener('abort',close);
}
