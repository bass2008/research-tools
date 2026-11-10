import { Tabs } from 'expo-router';
import { useApp } from '../../state/AppState';
import { colors, fonts } from '../../components/ui';
import { Icon, type IconName } from '../../components/BrandArt';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesign } from '../../state/Design';

export default function TabLayout() {
  const { t } = useApp();
  const { design } = useDesign();
  const insets = useSafeAreaInsets();
  const icons: Record<string, IconName> = { index: 'year', matrix: 'matrix', compatibility: 'pair', encyclopedia: 'book', account: 'account' };
  return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarHideOnKeyboard: true, tabBarActiveTintColor: design.accent, tabBarInactiveTintColor: colors.muted,
    tabBarIcon: ({ color }) => <Icon name={icons[route.name] ?? 'matrix'} color={color} size={21} />, tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 10, marginTop: 3 },
    tabBarStyle: { backgroundColor: design.chrome, borderTopColor: design.border, height: 62 + insets.bottom, paddingTop: 7, paddingBottom: Math.max(7, insets.bottom), elevation: 0 },
  })}>
    <Tabs.Screen name="index" options={{ title: t('Сегодня', 'Today'), tabBarButtonTestID: 'tab-today' }} />
    <Tabs.Screen name="matrix" options={{ title: t('Матрица', 'Matrix'), tabBarButtonTestID: 'tab-matrix' }} />
    <Tabs.Screen name="compatibility" options={{ title: t('Пара', 'Pair'), tabBarButtonTestID: 'tab-pair' }} />
    <Tabs.Screen name="encyclopedia" options={{ title: t('Знания', 'Library'), tabBarButtonTestID: 'tab-library' }} />
    <Tabs.Screen name="account" options={{ title: t('Кабинет', 'Account'), tabBarButtonTestID: 'tab-account' }} />
  </Tabs>;
}
