import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from 'expo-router';
import { forLocale as mapForLocale } from '@/lib/matrixMap';
import { forLocale as arcanaForLocale } from '@/lib/arcana';
import type { SectionOut } from '@/lib/publicSpec';
import { useApp } from '../state/AppState';
import { DesignSurface, useDesign } from '../state/Design';
import { chapterForPoint, chapterTitle, pointArticle } from '../native/personalReading';
import { ChartCover } from './ChartCover';
import { ArcanumImage } from './ArcanumImage';
import { Action, Body, Heading, fonts } from './ui';
import { AppLink } from './AppLink';
import { useReader } from './ReaderNavigation';

export function PersonalChart({ points, sections = [], initialPoint, onReadChapter, birthLabel }: {
  birthLabel?: string; points: Record<string, number>; sections?: SectionOut[]; initialPoint?: string;
  onReadChapter?: (key: string) => void;
}) {
  const { locale, t } = useApp();
  const { design } = useDesign();
  const reader = useReader();
  const focused = useIsFocused();
  const [selected, setSelected] = useState<string | null>(initialPoint ?? null);
  const [open, setOpen] = useState(!!initialPoint);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    let live = true;
    void SecureStore.getItemAsync('arcana.point-tapped').then(value => {
      if (live) setHint(value !== '1');
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  const point = mapForLocale(locale).MAP_POINTS.find(p => p.symbol === selected || p.key === selected);
  const n = point ? points[point.symbol] ?? points[point.key] : undefined;
  const arcanum = n ? arcanaForLocale(locale).arcanum(n) : null;
  const chapter = point && n ? chapterForPoint(sections, point, n) : undefined;
  const href = point && n ? pointArticle(locale, point.key, n) : '';
  return <>
    <ChartCover title={t('Личная матрица', 'Personal matrix')} dates={birthLabel ? [birthLabel] : []}
      caption={hint ? t('Нажмите на любую точку', 'Tap any point') : undefined}
      points={points} selectedPoint={point?.symbol} showCaption={false}
        onSelectPoint={symbol => {
          setSelected(symbol); setOpen(true); setHint(false);
          void Haptics.selectionAsync().catch(() => {});
          void SecureStore.setItemAsync('arcana.point-tapped', '1').catch(() => {});
        }} />
    <Modal visible={focused && open && !!arcanum} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
          accessibilityLabel={t('Закрыть', 'Close')} onPress={() => setOpen(false)} />
        <DesignSurface kind="paper">
          <View testID="point-sheet" accessibilityViewIsModal style={[s.sheet, { backgroundColor: design.paper }]}>
            <View style={s.header}>
              <View style={{ flex: 1 }}><Heading>{point?.label}</Heading></View>
              <Pressable testID="close-point-sheet" accessibilityRole="button"
                accessibilityLabel={t('Закрыть', 'Close')} onPress={() => setOpen(false)} style={s.close}>
                <Text style={{ fontFamily: fonts.body, fontSize: 27, color: '#6b726b' }}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.content}>
              {arcanum && <>
                <View style={{ alignItems: 'center', gap: 16 }}>
                  <ArcanumImage n={arcanum.n} width={142} decorative />
                  <Heading>{`${arcanum.n} · ${arcanum.title}`}</Heading>
                </View>
                <Body>{arcanum.short}</Body>
                {chapter && <Action testID="point-read-chapter"
                  title={t(`Читать главу «${chapterTitle(chapter.title)}»`, `Read “${chapterTitle(chapter.title)}”`)}
                  onPress={() => {
                    setOpen(false);
                    if (onReadChapter) onReadChapter(chapter.key);
                    else reader?.select(chapter.key);
                  }} />}
                <AppLink testID="point-article" href={href} onNavigate={() => setOpen(false)}
                  label={href.includes('/position/')
                    ? t(`${arcanum.n} в этой позиции`, `${arcanum.n} in this position`)
                    : t(`Об аркане ${arcanum.n}`, `About arcanum ${arcanum.n}`)} />
              </>}
            </ScrollView>
          </View>
        </DesignSurface>
      </SafeAreaView>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(27,37,54,0.38)' },
  sheet: { maxHeight: '88%', marginHorizontal: 8, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, paddingBottom: 6 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 10, gap: 18 },
});
