import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, Pressable, Text } from 'react-native';
import { useApp } from '../state/AppState';
import { internalTarget } from '../native/navigation';
import { styles } from './ui';
import { usePalette } from '../state/Design';

export function useNavigate() {
  const { setLocale } = useApp();
  return async (href: string) => {
    const target = internalTarget(href);
    if (target.locale) setLocale(target.locale);
    if (/^(mailto|tel):/.test(target.path)) await Linking.openURL(target.path);
    else if (target.external) await WebBrowser.openBrowserAsync(target.path);
    else if (target.path.startsWith('/matrix?')) {
      const params = new URLSearchParams(target.path.split('?')[1]);
      if (!params.has('point')) params.set('point', '');
      if (!params.has('chapter')) params.set('chapter', '');
      params.set('selection', String(Date.now()));
      router.push(`/matrix?${params}` as Href);
    } else router.push(target.path as Href);
  };
}
export function AppLink({ href, label, testID, onNavigate }: { href: string; label: string; testID?: string; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const palette = usePalette();
  return <Pressable accessibilityRole="link" testID={testID} onPress={() => { onNavigate?.(); void navigate(href).catch(e => Alert.alert(String(e.message))); }} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.55 : 1 })}>
    <Text style={[styles.link, { color: palette.accent }]}>{label}</Text>
  </Pressable>;
}
