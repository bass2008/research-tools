import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { router, type Href } from 'expo-router';
import type { SectionOut } from '@/lib/publicSpec';
import { useApp } from '../state/AppState';
import { useBilling } from '../state/Billing';
import { usePersonalReport } from '../state/usePersonalReport';
import { useReadingProgress } from '../state/useReadingProgress';
import { chapterTitle, type ReportParams } from '../native/personalReading';
import { Action, Body, Card, Heading, Page, RemoteStatus, RichText, colors, fonts } from './ui';
import { AppLink } from './AppLink';
import { ArcanumCards } from './ArcanumCards';
import { ArcanumImage } from './ArcanumImage';
import { ReadingNavigation } from './ReadingNavigation';
import { ReadingSectionBody } from './ReadingSections';
import { ReadingActions } from './ReadingActions';
import { Icon } from './BrandArt';
import { Kicker } from './DesignElements';
import { chapterHaptic } from '../native/haptics';

function ChapterCards({ section }: { section: SectionOut }) {
  const cards = section.positions.map(p => ({ arcanum: p.arcanum,
    label: section.locked ? String(p.arcanum) : p.label }));
  if (cards.length <= 4) return <ArcanumCards maxWidth={92}
    columns={cards.length === 4 && section.locked ? 4 : undefined} cards={cards} />;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ gap: 16, paddingVertical: 8 }}>
    {cards.map((card, index) => <View key={index} style={{ width: 92, alignItems: 'center', gap: 8 }}>
      <ArcanumImage n={card.arcanum} width={72} decorative />
      <Text style={{ fontFamily: fonts.display, fontSize: 17, lineHeight: 21, textAlign: 'center', color: '#243632' }}>
        {card.arcanum} · {card.label}
      </Text>
    </View>)}
  </ScrollView>;
}

export function LockedChapter({ section, sections, params }: {
  section: SectionOut; sections: SectionOut[]; params: ReportParams;
}) {
  const { t, session } = useApp();
  const billing = useBilling();
  const count = sections.filter(s => s.locked).length;
  const price = billing.canPurchase && !session?.deletion ? billing.price('single') : null;
  const query = new URLSearchParams({ product: 'single', chapter: section.key });
  if (params.id) query.set('id', params.id);
  else for (const key of ['birth', 'sex'] as const) if (params[key]) query.set(key, params[key]!);
  const target = !!(params.id || params.birth);
  return <View style={{ gap: 22 }}>
    <ChapterCards section={section} />
    {typeof section.teaser === 'string' && !!section.teaser && <RichText
      text={section.teaser.replace(/^(\d+) позиций в полном разборе$/, 'Позиций в полном разборе: $1')} />}
    <Card style={{ borderColor: colors.gold, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="lock" size={17} color={colors.gold} />
        <Kicker>{t('Полный разбор', 'Full reading')}</Kicker>
      </View>
      <Body>{t('Эта глава входит в полный разбор вашей даты.', 'This chapter is part of your date’s full reading.')}</Body>
      {billing.canPurchase && !session?.deletion && target && <>
        <Heading>{t(`Откроются все закрытые главы · ${count}`, `Unlock every locked chapter · ${count}`)}</Heading>
        <Body muted>{t('Разовая покупка: все главы этой даты и PDF без ограничения срока.',
          'One-time purchase: every chapter for this date and a PDF, with no expiry.')}</Body>
        {price ? <Action testID="chapter-purchase" tone="gold"
          title={t(`Открыть разбор · ${price}`, `Unlock reading · ${price}`)}
          onPress={() => router.push(`/purchase?${query}` as Href)} />
          : <Body muted>{t('Цена Google Play пока не загрузилась.', 'The Google Play price has not loaded yet.')}</Body>}
      </>}
      <AppLink href="/account" label={t('Уже купленное — в кабинете', 'Find purchased readings in your account')} />
    </Card>
  </View>;
}

export function ChapterReader({ params }: { params: ReportParams }) {
  const { t } = useApp();
  const report = usePersonalReport(params);
  const { readKeys, complete, remember } = useReadingProgress(report.readerKey);
  const [contents, setContents] = useState(false);
  const scroll = useRef<ScrollViewInstance | null>(null);
  const completed = useRef(false);
  const endY = useRef<{ key: string; y: number } | null>(null);
  const { sections = [], calculation, saved, remote } = report;
  const index = sections.findIndex(section => section.key === params.chapter);
  const section = sections[index], next = sections[index + 1];
  const rememberRef = useRef(remember);
  useEffect(() => { rememberRef.current = remember; }, [remember]);
  const sectionKey = section?.key;
  useEffect(() => {
    completed.current = false;
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (sectionKey) {
      chapterHaptic();
      void rememberRef.current(sectionKey);
    }
  }, [sectionKey, report.readerKey]);
  const select = (key: string) => {
    setContents(false);
    router.setParams({ chapter: key });
  };
  return <>
    <Page footer={sections.length > 0 && <ReadingNavigation items={sections.map(item => ({
      ...item, title: chapterTitle(item.title),
    }))} activeKey={section?.key} contentsOpen={contents} onContents={setContents}
      onSelect={select} readKeys={readKeys} />} scrollRef={scroll} onScroll={event => {
      if (!section || section.locked || completed.current || endY.current?.key !== section.key) return;
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      if (contentOffset.y + layoutMeasurement.height >= endY.current.y + 36) {
        completed.current = true; void complete(section.key);
      }
    }}>

      <RemoteStatus {...remote} />
      {section && <>
        <View testID={`chapter-${section.key}`} style={{ gap: 8 }}>
          <Kicker>{t(`Глава ${String(index + 1).padStart(2, '0')}`, `Chapter ${String(index + 1).padStart(2, '0')}`)}</Kicker>
          <Text accessibilityRole="header" style={s.title}>{chapterTitle(section.title)}</Text>
          {calculation?.birth && <Body muted>{report.engine.birthLabel(calculation.birth)}</Body>}
        </View>
        {section.locked ? <LockedChapter section={section} sections={sections}
          params={{ ...params, birth: calculation?.birth, sex: calculation?.sex }} />
          : <>
            {section.longform && section.positions.length > 0 && <ChapterCards section={section} />}
            <ReadingSectionBody section={section} />
          </>}
        <View testID="chapter-end" onLayout={event => {
          endY.current = { key: section.key, y: event.nativeEvent.layout.y };
        }} style={s.end}>
          {next ? <Pressable testID="chapter-next" accessibilityRole="button" onPress={() => {
            if (!section.locked) void complete(section.key);
            select(next.key);
          }} style={s.next}>
            <View style={{ flex: 1, gap: 6 }}>
              <Kicker>{t('Следующая глава', 'Next chapter')}</Kicker>
              <Heading>{chapterTitle(next.title)}</Heading>
            </View>
            <Icon name={next.locked ? 'lock' : 'arrow'} color={colors.gold} size={19} />
          </Pressable> : <Action secondary title={t('К оглавлению', 'Back to contents')}
            onPress={() => { if (!section.locked) void complete(section.key); setContents(true); }} />}
        </View>
        {saved.data?.row.unlocked && <ReadingActions id={saved.data.row.id} unlocked until={saved.data.row.access_until} />}
      </>}
      {!section && !remote.loading && !remote.error && <AppLink href="/matrix"
        label={t('Открыть оглавление моей матрицы', 'Open my matrix contents')} />}
    </Page>

  </>;
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: '#243632' },
  end: { borderTopWidth: 1, borderColor: colors.border, marginTop: 12, paddingTop: 16 },
  next: { flexDirection: 'row', gap: 14, alignItems: 'center', minHeight: 74 },
});
