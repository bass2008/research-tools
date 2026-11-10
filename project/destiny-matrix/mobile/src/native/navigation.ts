export function internalTarget(href: string): { locale?: 'ru' | 'en'; path: string; external?: boolean } {
  const url = new URL(href, 'https://arcana-sense.com');
  if (['mailto:', 'tel:'].includes(url.protocol)) return { path: url.href, external: true };
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported link');
  if (!['arcana-sense.com', 'test.arcana-sense.com', 'arcana-sense.ru'].includes(url.hostname)) return { path: url.href, external: true };
  let path = url.pathname;
  const prefix = path.match(/^\/(ru|en)(\/|$)/);
  const locale = prefix?.[1] as 'ru' | 'en' | undefined;
  if (prefix) path = path.slice(3) || '/';
  const search = new URLSearchParams(url.search);
  // Existing account e-mails carry single-use tokens in the fragment.
  if (path === '/account/confirm' || path === '/reset') {
    const fragment = new URLSearchParams(url.hash.slice(1));
    for (const key of ['token', 'kind']) if (fragment.has(key)) search.set(key, fragment.get(key)!);
  }
  const query = search.size ? `?${search}` : '';
  if (path === '/account/delete') return { locale, path: '/settings' + query };
  if (path === '/purchase') return { locale, path: path + query };
  if (/^\/pay(?:\/|$)/.test(path)) return { locale, path: '/purchase' };
  if (/^\/matrices\/\d+$/.test(path)) return { locale, path: `/report?id=${path.split('/').pop()}` };
  if (/^\/readings\/\d+$/.test(path)) return { locale, path: `/reading/${path.split('/').pop()}` };
  if (['/', '/matrix', '/my-date', '/calculate', '/compatibility', '/year', '/login', '/register', '/forgot', '/reset', '/settings', '/account', '/account/confirm'].includes(path)) return { locale, path: path + query };
  if (/^\/encyclopedia(?:\/|$)/.test(path)) return { locale, path: path + query };
  if (path === '/report') return { locale, path: path + query };
  if (/^\/year\/[^/]+$/.test(path) || ['/support', '/contacts', '/privacy', '/terms', '/refund'].includes(path))
    return { locale, path: `/article?path=${encodeURIComponent(path + query)}` };
  return { locale, path: url.href, external: true };
}
