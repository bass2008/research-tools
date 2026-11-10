import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { forLocale as mapForLocale } from '@/lib/matrixMap';
import { forLocale as matrixForLocale } from '@/lib/matrix';
import { useApp } from '../../state/AppState';
import { useMyReading } from '../../state/useMyReading';
import { readReaderPosition, readerPosition } from '../../native/readerPosition';
import { useDailySelection } from '../../daily/DailyProvider';
import { Card, Heading, Page, fonts } from '../../components/ui';
import { DeckStill, DisplayTitle, Kicker } from '../../components/DesignElements';
import { Icon } from '../../components/BrandArt';
import { DailyTheme } from '../../components/DailyTheme';
import { AppLink } from '../../components/AppLink';
import { MyDateForm } from '../../components/MyDateForm';
import { TabHeading } from '../../components/TabHeading';
import { TodayForecast } from '../../components/TodayForecast';
import { chapterHref, chapterTitle } from '../../native/personalReading';
import { MatrixMap } from '../../components/MatrixMap';
import { ReminderSetting } from '../../components/ReminderSetting';

export default function Home() {
  const { locale, t, session, base } = useApp();
  const { me, points, sections, readerKey, params } = useMyReading();
  const day = useDailySelection();
  const [chapterKey, setChapterKey] = useState<string | null>(null);
  const userId = session?.user.id;
  const deleting = !!session?.deletion;
  useFocusEffect(useCallback(() => {
    let live = true;
    const position = readerPosition(readerKey, { userId, deleting, base });
    void readReaderPosition(position).then(value => { if (live) setChapterKey(value); });
    return () => { live = false; };
  }, [readerKey, userId, deleting, base]));
  if (!me) return <Page tab scene="home">
    <DeckStill large />
    <DisplayTitle center>{t('Начните с себя', 'Begin with yourself')}</DisplayTitle>
    <MyDateForm />
    <AppLink testID="home-demo-preview" href="/encyclopedia/demo?view=reading"
      label={t('Сначала посмотреть пример', 'Explore a sample first')} />
  </Page>;
  const [year, month, date] = day.dateKey.split('-').map(Number);
  const now = new Date(year, month - 1, date, 12);
  const dateLabel = now.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const matches = mapForLocale(locale).MAP_POINTS.filter(point => points[point.symbol] === day.arcanum);
  const chapter = sections?.find(section => section.key === chapterKey);
  const matchLabel = matches.length ? t(
    `В вашей матрице эта карта — «${matches[0].label}»${matches.length > 1 ? ` и ещё в ${matches.length - 1}` : ''}`,
    `In your matrix this card is “${matches[0].label}”${matches.length > 1 ? ` and in ${matches.length - 1} more positions` : ''}`,
  ) : '';
  return <Page tab scene="home">
    <TabHeading title={t('Сегодня', 'Today')} eyebrow={dateLabel} settings />
    <View style={{ gap: 4 }}>
      <DailyTheme>
      {!!matches.length && <Pressable testID="daily-matrix-point" accessibilityRole="button"
        onPress={() => router.navigate({ pathname: '/matrix', params: {
          point: matches[0].symbol, chapter: '', selection: String(Date.now()),
        } })} style={({ pressed }) => ({
          minHeight: 52, paddingVertical: 14, borderTopWidth: 1, borderColor: '#d9c9ac',
          flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.65 : 1,
        })}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: '#087b75' }}>{matchLabel}</Text>
        <Icon name="arrow" size={19} color="#087b75" />
      </Pressable>}
      </DailyTheme>
      <ReminderSetting />
    </View>
    <TodayForecast birth={me.birth} year={year} month={month} />
    <Pressable testID="today-matrix" accessibilityRole="link" onPress={() => router.navigate({ pathname: '/matrix', params: { point: '', chapter: '', selection: String(Date.now()) } })}>
      <Card style={{ backgroundColor: 'transparent', borderWidth: 0, borderTopWidth: 1, boxShadow: 'none', paddingHorizontal: 0 }}>
        <Kicker>{t('Моя матрица', 'My matrix')}</Kicker>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View pointerEvents="none" style={{ width: 128 }}>
            <MatrixMap points={points} miniature />
          </View>
          <View style={{ flex: 1 }}><Heading>{matrixForLocale(locale).birthLabel(me.birth)}</Heading></View>
        </View>
      </Card>
    </Pressable>
    {chapter && <AppLink testID="continue-reading"
      href={chapterHref(params, chapter.key)}
      label={t(`Продолжить чтение: ${chapterTitle(chapter.title)}`, `Continue reading: ${chapterTitle(chapter.title)}`)} />}
  </Page>;
}
