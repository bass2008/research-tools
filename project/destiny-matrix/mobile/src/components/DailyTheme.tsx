import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { arcanumTitle } from '../daily/arcanumTitles';
import { useApp } from '../state/AppState';
import { dailyContent } from '../daily/content';
import { useDailySelection } from '../daily/DailyProvider';
import { ArcanumImage } from './ArcanumImage';
import { Action, Body, Card, Heading } from './ui';
import { Kicker } from './DesignElements';
import { ShareCard } from './ShareCard';

export function DailyTheme({ showAction = true, children }: { showAction?: boolean; children?: ReactNode }) {
  const { locale, t } = useApp();
  const day = useDailySelection();
  const content = dailyContent(locale, day.arcanum);
  return <View testID="daily-theme">
    <Card style={{ gap: 18, padding: 22 }}>
      <Kicker>{t('Тема дня', 'Today’s theme')}</Kicker>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <ArcanumImage n={day.arcanum} width={152} decorative />
        <Body muted>{`${day.arcanum} · ${arcanumTitle(locale, day.arcanum)}`}</Body>
      </View>
      <Heading>{content.title}</Heading>
      <Body>{content.question}</Body>
      {showAction && <Action testID="open-daily-theme" title={t('Прочитать тему', 'Read today’s theme')}
        onPress={() => router.push('/encyclopedia/today')} />}
      <ShareCard content={{ kind: 'daily', arcanum: day.arcanum }} />
      {children}
    </Card>
  </View>;
}
