import { internalTarget } from '../native/navigation';
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    // A development client restores its Metro launcher URL after Android recreates
    // the activity (for example when changing display size). This is an app launch.
    if (/^exp\+arcana-sense:\/\//i.test(path)) {
      const launcher = new URL(path);
      if (launcher.host === 'expo-development-client' || launcher.searchParams.has('__expo_url')
        || !launcher.host && (!launcher.pathname || launcher.pathname === '/')) return '/';
    }
    const incoming = /^arcanasense:/i.test(path) ? new URL(path) : null;
    const route = incoming ? [incoming.host, incoming.pathname.replace(/^\/+/, '')].filter(Boolean).join('/') : '';
    const normalized = incoming ? `https://arcana-sense.com/${route}${incoming.search}${incoming.hash}` : path;
    const target = internalTarget(normalized);
    if (target.external) return `/external?url=${encodeURIComponent(target.path)}`;
    return target.path + (target.locale ? `${target.path.includes('?') ? '&' : '?'}lang=${target.locale}` : '');
  } catch { return '/+not-found'; }
}
