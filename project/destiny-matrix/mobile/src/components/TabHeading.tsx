import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../state/AppState';
import { usePalette } from '../state/Design';
import { Icon } from './BrandArt';
import { DisplayTitle, Kicker } from './DesignElements';

export function TabHeading({ title, eyebrow, settings = false }: {
  title: string; eyebrow?: string; settings?: boolean;
}) {
  const { t } = useApp();
  const palette = usePalette();
  return <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
    <View style={{ flex: 1, gap: 4 }}>
      {eyebrow && <Kicker>{eyebrow}</Kicker>}
      <DisplayTitle>{title}</DisplayTitle>
    </View>
    {settings && <Pressable testID="open-settings" accessibilityRole="button"
      accessibilityLabel={t('Настройки', 'Settings')} onPress={() => router.push('/settings')}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="settings" color={palette.ink} size={21} />
    </Pressable>}
  </View>;
}
