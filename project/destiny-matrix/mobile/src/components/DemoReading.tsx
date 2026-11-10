import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { forLocale as matrixForLocale } from '@/lib/matrix';
import { useApp } from '../state/AppState';
import { demoReading, type DemoReadingData } from '../demo/demoReading';
import { chapterTitle } from '../native/personalReading';
import { ChartCover } from './ChartCover';
import { useDesign, usePalette } from '../state/Design';
import { ReadingSection } from './ReadingSections';
import { ReaderAnchor, ReaderContentsButton, ReaderPage, ReaderSectionEnd, useReaderSections } from './ReaderNavigation';
import { Action, Body, Heading, colors, fonts } from './ui';
import { Icon } from './BrandArt';
import { useNavigate } from './AppLink';

function CalculateFromDemo({ position }: { position: 'start' | 'end' }) {
  const { t } = useApp(); const navigate = useNavigate();
  return <View style={{ gap: 8, paddingVertical: position === 'end' ? 10 : 2 }}>
    {position === 'end' && <><Heading>{t('Теперь — ваша матрица', 'Now, your own chart')}</Heading>
      <Body muted>{t('Схема и бесплатная часть разбора — без регистрации.', 'Your chart and free preview need no account.')}</Body></>}
    <Action testID={`demo-calculate-${position}`} secondary={position === 'start'}
      title={t('Рассчитать свою матрицу', 'Calculate my chart')} onPress={() => navigate('/calculate')} />
  </View>;
}

function DemoSections({ demo, startReading, onReady }: { demo: DemoReadingData; startReading: boolean; onReady: () => void }) {
  const reader = useReaderSections(demo.sections.map(({ key, title, positions }) => ({ key, title, positions })), `demo:${demo.locale}`);
  const readyFrame = useRef<number | null>(null);
  useEffect(() => () => { if (readyFrame.current !== null) cancelAnimationFrame(readyFrame.current); }, []);
  return <>
    <ReaderContentsButton />
    {demo.sections.map((section, index) => <ReaderAnchor key={section.key} sectionKey={section.key}>
      <View testID={`demo-chapter-${section.key}`} style={{ gap: 10 }} onLayout={() => {
        if (!startReading || reader?.openKey !== section.key) return;
        if (readyFrame.current !== null) cancelAnimationFrame(readyFrame.current);
        // The reader jumps in its next frame after native section measurement.
        // Publish screenshot readiness one frame later, at the real reading position.
        readyFrame.current = requestAnimationFrame(() => { readyFrame.current = requestAnimationFrame(onReady); });
      }}>
        {startReading && reader?.openKey === section.key && <CalculateFromDemo position="start" />}
        {section.key === 'years' && reader?.openKey === section.key && <Body muted>{demo.periodNotice}</Body>}
        <ReadingSection section={section} number={index + 1} open={reader?.openKey === section.key} onOpenChange={open => reader?.toggle(section.key, open)}
          footer={<><ReaderSectionEnd sectionKey={section.key} />{index === demo.sections.length - 1 && <CalculateFromDemo position="end" />}</>} />
      </View>
    </ReaderAnchor>)}
  </>;
}

/** Real phase-one report content, available immediately without authentication or HTTP. */
export function DemoReading({ initialScene = 'chart', initialChapter }: { initialScene?: 'chart' | 'reading'; initialChapter?: string }) {
  const { locale, t } = useApp();
  const { design } = useDesign();
  const [scene, setScene] = useState(initialScene);
  const [requestedChapter, setRequestedChapter] = useState(initialChapter);
  const [readyScene, setReadyScene] = useState<'chart' | 'reading' | undefined>(initialScene === 'chart' ? 'chart' : undefined);
  const ready = useCallback(() => { setReadyScene('reading'); setRequestedChapter(undefined); }, []);
  const changeScene = (next: 'chart' | 'reading') => { setRequestedChapter(undefined); setReadyScene(next === 'chart' ? next : undefined); setScene(next); };
  const demo = useMemo(() => {
    const reading = demoReading(locale);
    return { ...reading, sections: reading.sections.map(section => ({ ...section, title: chapterTitle(section.title) })) };
  }, [locale]);
  const date = matrixForLocale(locale).birthLabel(demo.birth);
  const chapter = demo.sections.some(section => section.key === requestedChapter) ? requestedChapter : undefined;
  return <ReaderPage scene={readyScene} contentsTitle={t('Пример разбора', 'Sample reading')} readerKey={`demo:${locale}:${scene}`} positionKey="automatic-demo-v1" publicExample
    restorePosition={scene === 'reading'} initialSection={chapter} fallbackSection={demo.sections[0].key}
    footer={<View testID="demo-persistent-label" style={[s.demoLabel, { backgroundColor: design.paper, borderColor: design.border }]}>
    <Text style={s.label}>{t('Демонстрационный пример', 'Sample reading')} · {date}</Text>
  </View>}>
    <View testID="demo-reading" style={{ gap: 10 }}>
      <Heading>{scene === 'chart' ? t('Схема примера', 'The sample chart') : demo.title}</Heading>
      {scene === 'chart' && <CalculateFromDemo position="start" />}
    </View>
    {scene === 'chart' ? <ChartCover title={t('Условная дата рождения', 'Sample date of birth')} dates={[date]} points={demo.points}
      testID="demo-chart"
      action={{ testID: 'demo-open-reading', title: t('Читать полный пример', 'Read the full example'), onPress: () => changeScene('reading') }} />
      : <DemoChartLink onPress={() => changeScene('chart')} />}
    <DemoSections demo={demo} startReading={scene === 'reading'} onReady={ready} />
  </ReaderPage>;
}

function DemoChartLink({ onPress }: { onPress: () => void }) {
  const p = usePalette(); const { t } = useApp();
  return <Pressable testID="demo-show-chart" accessibilityRole="button" onPress={onPress} style={s.chartLink}>
    <Icon name="matrix" color={p.accent} size={20} /><Text style={[s.link, { color: p.accent }]}>{t('Посмотреть схему примера', 'View the sample chart')}</Text>
  </Pressable>;
}

const s = StyleSheet.create({
  demoLabel: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 5, backgroundColor: colors.card2, borderTopWidth: 1, borderTopColor: colors.border },
  label: { fontFamily: fonts.body, fontSize: 10, lineHeight: 16, color: colors.muted, textAlign: 'center' },
  chartLink: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44 },
  link: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 20, color: '#087c76', flex: 1 },
});
