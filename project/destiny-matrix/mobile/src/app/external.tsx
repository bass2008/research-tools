import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useApp } from '../state/AppState';
import { Action, Body, Page } from '../components/ui';
export default function External() {
  const { url } = useLocalSearchParams<{ url: string }>(); const { t } = useApp();
  return <Page title={t('Открыть на сайте', 'Open on the website')}><Body>{t('Этот раздел доступен в браузере.', 'This section is available in your browser.')}</Body>
    <Action title={t('Открыть в браузере', 'Open in browser')} onPress={async () => {
      const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported URL');
      await WebBrowser.openBrowserAsync(parsed.href);
    }} />
  </Page>;
}
