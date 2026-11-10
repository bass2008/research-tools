import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const local = process.env.ARCANA_MOBILE_LOCAL === '1';
  const base = process.env.EXPO_PUBLIC_API_BASE ?? 'https://arcana-sense.com';
  const errorsDsn = process.env.EXPO_PUBLIC_ERRORS_DSN ?? '';
  const release = process.env.ARCANA_MOBILE_RELEASE ?? 'mobile@0.1.0';
  if (!local && !base.startsWith('https://')) throw new Error('Release API requires HTTPS');
  return {
    ...config,
    name: 'Arcana Sense', slug: 'arcana-sense', scheme: 'arcanasense',
    android: {
      ...config.android, allowBackup: false,
      intentFilters: [{ action: 'VIEW', autoVerify: true, category: ['BROWSABLE', 'DEFAULT'],
        data: ['arcana-sense.com', 'test.arcana-sense.com'].flatMap(host =>
          ['/ru/', '/en/'].map(pathPrefix => ({ scheme: 'https', host, pathPrefix }))),
      }],
    },
    // Android Google Credential Manager autolinks from the native dependency and
    // receives an explicit client ID from our API. The library's config plugin
    // configures Firebase files/iOS URL schemes, which this Android build does not use.
    plugins: [...(config.plugins ?? []).map(plugin => plugin === 'expo-build-properties'
      ? ['expo-build-properties', { android: { usesCleartextTraffic: local } }]
      : plugin), 'expo-web-browser', 'expo-iap', ['@sentry/react-native', { disableAutoUpload: true }],
      ['./plugins/withNativeErrors', { dsn: errorsDsn, release, local }], './plugins/withBrandFonts',
      '@react-native-community/datetimepicker', './plugins/withDailyScheduler',
      ['react-native-android-widget', { widgets: [{
        name: 'DailyTheme', label: 'Arcana Sense', description: 'Тема дня · Today’s theme',
        minWidth: '250dp', minHeight: '140dp', targetCellWidth: 4, targetCellHeight: 2,
        resizeMode: 'horizontal|vertical', updatePeriodMillis: 1800000,
      }] }]] as ExpoConfig['plugins'],
    extra: { ...config.extra, apiBase: base.replace(/\/+$/, ''), local,
      errorsDsn, release,
    },
  };
};
