import {useEffect, useState} from 'react';

type Order = {
  id: string;
  status: string;
  username: string | null;
  created_at: string;
  details: {game_id?: string; name?: string; price_usd?: string};
};
type Orders = {data: Order[]; counts: Record<string, number>};
type Overview = {
  counts: Record<string, number>;
  revenue_usd: string | null;
  estimated_gross_profit_usd: string | null;
  missing_cost_count: number;
};
type Sources = {data: Array<{id?: string; source_id?: string; name: string; enabled: boolean; package_count?: number}>};
type Navigation = {pending_review_orders: number; unread_chat_rooms: number};
type TelegramWebApp = {initData?: string; ready?: () => void; expand?: () => void; setHeaderColor?: (color: string) => void};

const webApp = () => (window as Window & {Telegram?: {WebApp?: TelegramWebApp}}).Telegram?.WebApp;
let telegramScript: Promise<void> | undefined;
function loadTelegram() {
  if (webApp()) return Promise.resolve();
  return telegramScript ??= new Promise(resolve => {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.onload = script.onerror = () => resolve();
    document.head.append(script);
  });
}
export const reviewQueue = '/orders?status=payment_review&include_mock=true';

class RequestError extends Error {
  constructor(readonly status: number) {
    super('Admin request failed');
  }
}

async function request<T>(path: string, signal: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch('/admin/v1' + path, {
    signal, credentials: 'same-origin',
    ...(body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {}),
  });
  if (!response.ok) throw new RequestError(response.status);
  return response.json();
}

type Resource<T> = {value?: T; failed?: boolean};
type Dashboard = {
  summary: Resource<Overview>;
  recent: Resource<Orders>;
  review: Resource<Orders>;
  sources: Resource<Sources>;
  navigation: Resource<Navigation>;
};
const initialData: Dashboard = {summary: {}, recent: {}, review: {}, sources: {}, navigation: {}};

export function useOverviewData() {
  const [session, setSession] = useState<'loading'|'ready'|'locked'|'expired'|'error'>('loading');
  const [data, setData] = useState(initialData);
  const [online, setOnline] = useState(navigator.onLine);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const {signal} = controller;
    function configureTelegram() {
      const app = webApp();
      app?.ready?.();
      app?.expand?.();
      app?.setHeaderColor?.('#ffffff');
    }
    configureTelegram();
    async function authenticate() {
      try {
        try {
          await request('/me', signal);
        } catch (error) {
          if (!(error instanceof RequestError) || error.status !== 401) throw error;
          await loadTelegram();
          if (signal.aborted) return;
          const initData = webApp()?.initData;
          if (!initData) throw error;
          configureTelegram();
          await request('/session', signal, {initData});
        }
        if (!signal.aborted) setSession('ready');
      } catch (error) {
        if (signal.aborted) return;
        setSession(error instanceof RequestError && [400,401,403].includes(error.status) ? 'locked' : 'error');
      }
    }
    void authenticate();
    return () => controller.abort();
  }, [sessionAttempt]);

  useEffect(() => {
    if (session !== 'ready') return;
    let active = true;
    let controller: AbortController | undefined;
    function load() {
      if (document.hidden || !navigator.onLine) return;
      controller?.abort();
      controller = new AbortController();
      const {signal} = controller;
      function read<K extends keyof Dashboard>(key: K, path: string) {
        void request<Dashboard[K]['value']>(path, signal).then(value => {
          if (active && !signal.aborted) setData(previous => ({...previous, [key]: {value}}));
        }).catch(error => {
          if (!active || signal.aborted) return;
          if (error instanceof RequestError && error.status === 401) {
            controller?.abort();
            setData(initialData);
            setSession('expired');
          } else {
            setData(previous => ({...previous, [key]: {...previous[key], failed: true}}));
          }
        });
      }
      read('summary', '/overview?include_mock=true');
      read('recent', '/orders?limit=3&include_mock=true');
      read('review', reviewQueue + '&limit=1');
      read('sources', '/sources');
      read('navigation', '/navigation');
    }
    const connectionChanged = () => {setOnline(navigator.onLine); load();};
    load();
    const timer = window.setInterval(load, 15_000);
    document.addEventListener('visibilitychange', load);
    window.addEventListener('online', connectionChanged);
    window.addEventListener('offline', connectionChanged);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
      window.removeEventListener('online', connectionChanged);
      window.removeEventListener('offline', connectionChanged);
    };
  }, [session, refresh]);

  return {
    session, data, online,
    reload: () => setRefresh(value => value + 1),
    reconnect: () => {setSession('loading'); setSessionAttempt(value => value + 1);},
  };
}
