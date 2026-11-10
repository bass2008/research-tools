import { isUser } from '../native/contracts';
import { record } from '../native/http';
import { useApp } from './AppState';
import { useRemote } from './useRemote';

export function productAccess(access: Record<string, unknown> | undefined, product: string) {
  if (!access) return { unlimited: false, until: null as string | null };
  if (access.all_free === true) return { unlimited: true, until: null };
  // Use the subscription rights, not the product summary's maximum of unrelated expiry dates.
  const rights = Array.isArray(access.rights) ? access.rights.filter(r => record(r) && r.per_reading === false &&
    Array.isArray(r.products) && (r.products.includes(product) || r.products.includes('*')) &&
    (r.expires_at === null || typeof r.expires_at === 'string' && Date.parse(r.expires_at) > Date.now())) : [];
  return { unlimited: !!rights.length, until: rights.some(r => r.expires_at === null) ? null :
    rights.length ? rights.map(r => String(r.expires_at)).sort((a, b) => Date.parse(b) - Date.parse(a))[0] : null };
}
export function useProductAccess(product: string) {
  const { session } = useApp();
  const me = useRemote(session && !session.deletion ? '/auth/me' : null, isUser, { private: true });
  return { ...productAccess(me.data?.access, product), loading: me.loading, error: me.error };
}
