import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { ProductOrSubscription, Purchase } from 'expo-iap';
import { useApp } from './AppState';
import { config } from '../native/config';
import { isRecord, record } from '../native/http';
import { purchaseHaptic } from '../native/haptics';

export type ProductId = 'single' | 'pair' | 'month';
type MockState = 'purchased' | 'pending' | 'canceled' | 'refunded' | 'renewed' | 'grace' | 'hold' | 'expired';
export interface Receipt { order_id: string; reading_id: number | null; state: string; access: boolean; expires_at: string | null; auto_renewing: boolean; finalized: boolean }
export const isReceipt = (v: unknown): v is Receipt => record(v) && typeof v.order_id === 'string' && typeof v.state === 'string' && typeof v.access === 'boolean' &&
  (v.reading_id === null || Number.isInteger(v.reading_id)) && (v.expires_at === null || typeof v.expires_at === 'string' && Number.isFinite(Date.parse(v.expires_at))) &&
  typeof v.auto_renewing === 'boolean' && typeof v.finalized === 'boolean';
interface Status { provider: 'mock' | 'google_play' | null; products: { product_id: ProductId; type: 'in-app' | 'subs' }[]; subscriptions: Receipt[] }
export const isStatus = (v: unknown): v is Status => record(v) && (v.provider === null || v.provider === 'mock' || v.provider === 'google_play') &&
  Array.isArray(v.products) && v.products.every(p => record(p) && ['single', 'pair', 'month'].includes(String(p.product_id)) && ['in-app', 'subs'].includes(String(p.type))) &&
  Array.isArray(v.subscriptions) && v.subscriptions.every(isReceipt);
export function purchaseAllowed(country: string | null, available: boolean) { return available && !!country && /^[A-Z]{2,3}$/.test(country) && !['RU', 'RUS'].includes(country); }
interface BillingState {
  status: Status | null; country: string | null; canPurchase: boolean; products: ProductOrSubscription[];
  price: (product: ProductId) => string | null; error: string; busy: boolean; receipt: Receipt | null;
  purchase: (product: ProductId, target: { reading_id?: number; inputs?: Record<string, unknown> }, mockState?: MockState) => Promise<void>;
  restore: () => Promise<void>; refresh: () => Promise<void>; setMockCountry: (country: string) => Promise<void>;
  simulate: (state: MockState) => Promise<void>;
}
const Context = createContext<BillingState | null>(null);
export function BillingProvider({ children }: { children: ReactNode }) {
  const app = useApp(); const latest = useRef(app);
  useLayoutEffect(() => { latest.current = app; }, [app]);
  const [status, setStatus] = useState<Status | null>(null), [country, setCountry] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOrSubscription[]>([]), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [receipt, setReceipt] = useState<Receipt | null>(null);
  const [connected, setConnected] = useState(false);
  const sdk = useRef<typeof import('expo-iap') | null>(null);
  const celebrated = useRef(new Set<string>());
  const accept = useCallback((value: Receipt) => {
    if (value.state === 'purchased' && value.access && !celebrated.current.has(value.order_id)) {
      celebrated.current.add(value.order_id);
      purchaseHaptic();
    }
    setReceipt(value);
    latest.current.invalidateAccess(!value.access && !['pending', 'canceled'].includes(value.state) ? value.reading_id : undefined);
  }, []);
  const refresh = useCallback(async () => {
    if (latest.current.session?.deletion) return;
    setStatus(await latest.current.api('/mobile/billing/status', isStatus));
  }, []);
  const restore = useCallback(async () => {
    if (!latest.current.session || latest.current.session.deletion) return;
    const purchases = sdk.current ? await sdk.current.getAvailablePurchases() : [];
    const result = await latest.current.api('/mobile/billing/restore', isRecord, { method: 'POST', body: { purchases: purchases
      .filter(p => p.purchaseToken && ['single', 'pair', 'month'].includes(p.productId))
      .map(p => ({ purchase_token: p.purchaseToken, product_id: p.productId })) } });
    if (result.failed) throw new Error(latest.current.t('Не все покупки удалось проверить. Повторите позже.', 'Some purchases could not be checked. Try again later.'));
    if (Array.isArray(result.items)) for (const value of result.items) if (isReceipt(value) && !value.access && !['pending', 'canceled'].includes(value.state)) latest.current.invalidateAccess(value.reading_id);
    latest.current.invalidateAccess();
    await refresh();
  }, [refresh]);
  useEffect(() => {
    if (!app.ready || app.session?.deletion) return;
    let live = true; let purchased: { remove: () => void } | undefined, failed: { remove: () => void } | undefined;
    let module: typeof import('expo-iap') | undefined;
    void (async () => {
      await Promise.resolve();
      if (!live) return;
      setReceipt(null); setCountry(null); setProducts([]); setConnected(false); setError(''); setBusy(false);
      const state = await latest.current.api('/mobile/billing/status', isStatus);
      if (!live) return; setStatus(state);
      if (state.provider === 'mock' && config.local) {
        const chosen = await SecureStore.getItemAsync('arcana.mock-country');
        if (live) { setCountry(chosen ?? 'RU'); setConnected(true); }
        if (latest.current.session) await restore();
        return;
      }
      if (state.provider !== 'google_play') return;
      module = await import('expo-iap');
      await module.initConnection();
      if (!live) { await module.endConnection(); return; }
      sdk.current = module;
      purchased = module.purchaseUpdatedListener((p: Purchase) => {
        if (!p.purchaseToken || !latest.current.session) return;
        void latest.current.api('/mobile/billing/verify', isReceipt, { method: 'POST', body: { product_id: p.productId, purchase_token: p.purchaseToken } })
          .then(value => { if (live) { accept(value); void refresh(); } })
          .catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setBusy(false); });
      });
      failed = module.purchaseErrorListener(e => { if (live) { setBusy(false); setError(e.code === 'user-cancelled' ? latest.current.t('Покупка отменена', 'Purchase canceled') : latest.current.t('Покупка не завершена. Попробуйте ещё раз.', 'Purchase did not complete. Try again.')); } });
      const storefront = await module.getStorefront();
      const fetched = await module.fetchProducts({ skus: state.products.map(p => p.product_id), type: 'all' });
      if (live) { setCountry(storefront.toUpperCase()); setProducts(fetched ?? []); setConnected(true); }
      if (latest.current.session) await restore();
    })().catch(e => { if (live) { setError(e.message); setConnected(false); } });
    return () => { live = false; purchased?.remove(); failed?.remove(); sdk.current = null; if (module) void module.endConnection(); };
  }, [app.ready, app.base, app.session?.user.id, app.session?.token, app.session?.deletion, refresh, restore, accept]);
  const canPurchase = !app.session?.deletion && purchaseAllowed(country, connected && !!status?.provider && (status.provider !== 'mock' || config.local));
  const price = (id: ProductId) => status?.provider === 'mock' && config.local ? (id === 'month' ? '€8.00' : '€5.00') : products.find(p => p.id === id)?.displayPrice ?? null;
  const purchase: BillingState['purchase'] = async (id, target, mockState = 'purchased') => {
    if (!canPurchase || !app.session) throw new Error(app.t('Покупка сейчас недоступна', 'Purchases are currently unavailable'));
    setBusy(true); setError(''); setReceipt(null);
    try {
      const order = await app.api('/mobile/billing/orders', isRecord, { method: 'POST', body: { product_id: id, ...target } });
      if (typeof order.order_id !== 'string' || typeof order.obfuscated_account_id !== 'string' || typeof order.obfuscated_profile_id !== 'string') throw new Error('Unsupported order response');
      if (status?.provider === 'mock' && config.local) {
        accept(await app.api('/mobile/billing/mock', isReceipt, { method: 'POST', body: { order_id: order.order_id, state: mockState } }));
        await refresh(); setBusy(false); return;
      }
      if (!sdk.current) throw new Error(app.t('Google Play недоступен', 'Google Play unavailable'));
      const product = products.find(p => p.id === id);
      const google = { skus: [id], obfuscatedAccountId: order.obfuscated_account_id, obfuscatedProfileId: order.obfuscated_profile_id };
      if (id === 'month') {
        const offer = product?.subscriptionOffers?.find(o => o.offerTokenAndroid && o.basePlanIdAndroid === 'quarterly');
        if (!offer?.offerTokenAndroid) throw new Error(app.t('Подписка на 3 месяца недоступна', 'The 3-month subscription is unavailable'));
        await sdk.current.requestPurchase({ type: 'subs', request: { google: { ...google, subscriptionOffers: [{ sku: id, offerToken: offer.offerTokenAndroid }] } } });
      } else await sdk.current.requestPurchase({ type: 'in-app', request: { google } });
      // Entitlement and acknowledgement/consumption are handled by our server, after verification.
    } catch (e) { setBusy(false); throw e; }
  };
  return <Context.Provider value={{ status, country, canPurchase, products, price, error, busy, receipt, purchase, restore, refresh,
    setMockCountry: async value => { if (!config.local || status?.provider !== 'mock') return; await SecureStore.setItemAsync('arcana.mock-country', value); setCountry(value); },
    simulate: async state => { if (!config.local || status?.provider !== 'mock' || !receipt) return;
      accept(await app.api('/mobile/billing/mock', isReceipt, { method: 'POST', body: { order_id: receipt.order_id, state } })); await refresh(); },
  }}>{children}</Context.Provider>;
}
export function useBilling() { const context = useContext(Context); if (!context) throw new Error('BillingProvider missing'); return context; }
