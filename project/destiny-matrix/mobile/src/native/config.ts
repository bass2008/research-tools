import Constants from 'expo-constants';
const extra = Constants.expoConfig?.extra ?? {};
export const config = {
  apiBase: String(extra.apiBase ?? 'https://arcana-sense.com'),
  local: extra.local === true,
  errorsDsn: String(extra.errorsDsn ?? ''),
  release: String(extra.release ?? 'mobile@0.1.0'),
};
