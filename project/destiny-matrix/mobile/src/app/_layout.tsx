import { Stack, useGlobalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, Text, View } from 'react-native';
import { AppProvider, useApp } from '../state/AppState';
import { BillingProvider } from '../state/Billing';
import { Action, Body, Card, Heading, colors, fonts } from '../components/ui';
import { BrandLogo } from '../components/BrandArt';
import { reportError } from '../native/errors';
import { useDesign } from '../state/Design';
import { MeProvider, useMe } from '../state/Me';
import { DailyProvider } from '../daily/DailyProvider';
import { arcanumTitle } from '../daily/arcanumTitles';
import { ReminderProvider } from '../state/Reminder';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => reportError(error), [error]);
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 28, backgroundColor: colors.bg }}>
    <View style={{ alignItems: 'center' }}><BrandLogo /></View><Card><Heading>Не удалось открыть экран</Heading><Body muted>Unable to open this screen</Body>
      <Action title="Повторить / Retry" onPress={retry} /></Card>
  </View>;
}

function Navigation() {
  const { setLocale, ready, storageError, t, locale } = useApp();
  const { design } = useDesign();
  const { ready: meReady } = useMe();
  const { lang } = useGlobalSearchParams<{ lang?: string }>();
  useEffect(() => { if (lang === 'ru' || lang === 'en') setLocale(lang); }, [lang, setLocale]);
  if (!ready || !meReady) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24, backgroundColor: design.background }}><BrandLogo /><ActivityIndicator color={design.accent} /></View>;
  if (storageError) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 24, backgroundColor: colors.bg }}><BrandLogo /><Card><Text accessibilityRole="alert" style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 24, color: colors.error }}>{storageError}</Text></Card></View>;
  const titles: Record<string, string> = {
    settings: t('Настройки', 'Settings'), 'my-date': t('Моя дата', 'My birth date'),
    calculate: t('Новая матрица', 'New chart'), year: t('Год', 'Year'),
    report: t('Матрица', 'Matrix'), 'reading/[id]': t('Разбор', 'Reading'),
    login: t('Вход', 'Sign in'), register: t('Регистрация', 'Create account'),
    forgot: t('Восстановление пароля', 'Reset password'), reset: t('Новый пароль', 'New password'),
    'account/confirm': t('Подтверждение', 'Confirmation'), purchase: t('Полный разбор', 'Full reading'),
    'encyclopedia/today': t('Тема дня', 'Today’s theme'),
    'encyclopedia/demo': t('Пример разбора', 'Sample reading'),
    'encyclopedia/reading': t('Мой разбор', 'My reading'),
    'encyclopedia/year': t('Аркан года', 'Year arcanum'),
    'encyclopedia/[...path]': t('Знания', 'Library'), article: t('Знания', 'Library'),
    external: t('Ссылка', 'Link'), '+not-found': t('Экран не найден', 'Screen not found'),
  };
  const articleTitle = (path?: string | string[]) => {
    const parts = Array.isArray(path) ? path : path?.split('/').filter(Boolean) ?? [];
    const category = parts[0] === 'encyclopedia' ? parts.slice(1) : parts;
    if (category[0] === 'arcanum' && /^([1-9]|1[0-9]|2[0-2])$/.test(category[1] ?? '')) {
      return `${category[1]} · ${arcanumTitle(locale, Number(category[1]))}`;
    }
    const names: Record<string, string> = {
      arcanum: t('Арканы', 'Arcana'), position: t('Позиции матрицы', 'Chart positions'),
      chakra: t('Чакры', 'Chakras'), combination: t('Сочетания', 'Combinations'),
      'karmic-tail': t('Кармический хвост', 'Karmic tail'), compatibility: t('Совместимость', 'Compatibility'),
      year: t('Аркан года', 'Year arcanum'), support: t('Поддержка', 'Support'),
      contacts: t('Контакты', 'Contact'), privacy: t('Конфиденциальность', 'Privacy'),
      terms: t('Условия', 'Terms'), refund: t('Возврат', 'Refunds'),
    };
    return names[category[0]] ?? t('Статья', 'Article');
  };
  return <><StatusBar style="dark" />
    <Stack screenOptions={({ route }) => ({ title: ['article', 'encyclopedia/[...path]'].includes(route.name)
      ? articleTitle((route.params as { path?: string | string[] } | undefined)?.path)
      : titles[route.name] ?? '', headerTintColor: design.chromeInk,
      headerTitleStyle: { fontFamily: fonts.body, fontSize: 15 }, headerBackButtonDisplayMode: 'minimal',
      headerStyle: { backgroundColor: design.chrome }, headerShadowVisible: false,
      statusBarStyle: 'dark',
      contentStyle: { backgroundColor: design.background },
    })}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  </>;

}
export default function Layout() {
  return <SafeAreaProvider><AppProvider><MeProvider><DailyProvider><ReminderProvider>
    <BillingProvider><Navigation /></BillingProvider>
  </ReminderProvider></DailyProvider></MeProvider></AppProvider></SafeAreaProvider>;
}
