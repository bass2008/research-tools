import { useEffect, useState } from 'react';
import { AccessibilityInfo, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppState';
import { ChapterContents, type ContentsItem } from './ChapterContents';
import { Icon } from './BrandArt';
import { Heading, colors, fonts } from './ui';

interface NavigationProps {
  items: ContentsItem[];
  activeKey?: string | null;
  contentsOpen: boolean;
  onContents: (open: boolean) => void;
  onSelect: (key: string) => void;
  readKeys?: string[];
  title?: string;
}

export function ReadingNavigation(props: NavigationProps) {
  const { t } = useApp();
  const { items, activeKey, contentsOpen, onContents, onSelect, readKeys, title } = props;
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let live = true;
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReducedMotion(value); }).catch(() => {});
    return () => { live = false; change.remove(); };
  }, []);
  return <>
    <ReaderToolbar {...props} />
    <Modal visible={contentsOpen} transparent animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={() => onContents(false)}>
      <SafeAreaView style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
          accessibilityLabel={t('Закрыть оглавление', 'Close contents')} onPress={() => onContents(false)} />
        <View testID="reader-contents-sheet" style={s.sheet} accessibilityViewIsModal>
          <View style={s.sheetHeading}>
            <View style={{ flex: 1 }}><Heading>{title ?? t('Мой разбор', 'My reading')}</Heading></View>
            <Pressable testID="reader-close-contents" accessibilityRole="button"
              accessibilityLabel={t('Закрыть', 'Close')} onPress={() => onContents(false)} style={s.close}>
              <Text style={s.closeText}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <ChapterContents sections={items} readKeys={readKeys} selected={activeKey ?? undefined}
              onSelect={key => { onContents(false); onSelect(key); }} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  </>;
}

function ReaderToolbar({ items, activeKey, onContents, onSelect }: NavigationProps) {
  const { t } = useApp();
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);
  const index = items.findIndex(item => item.key === activeKey);
  const current = items[index], next = items[index + 1];
  if (keyboard) return null;
  return <View testID="reader-toolbar" style={s.toolbar}>
    <Pressable testID="reader-contents" accessibilityRole="button"
      accessibilityLabel={current ? `${t('Оглавление', 'Contents')}: ${current.title}` : t('Разделы разбора', 'Reading sections')}
      onPress={() => onContents(true)} style={s.current}>
      <Icon name="book" color={colors.teal} size={21} /><View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={s.progress}>{current ? `${index + 1} / ${items.length} · ${t('Оглавление', 'Contents')}` : t('Разделы разбора', 'Reading sections')}</Text>
        <Text testID="reader-current-title" style={s.currentTitle}>{current?.title ?? t('Выбрать раздел', 'Choose a section')}</Text>
      </View>
    </Pressable>
    {next && <Pressable testID="reader-next" accessibilityRole="button" accessibilityLabel={`${t('Далее', 'Next')}: ${next.title}`}
      onPress={() => onSelect(next.key)} style={s.next}>
      <Text style={s.nextLabel}>{current ? t('Далее', 'Next') : t('Начать', 'Start')}</Text><Icon name="arrow" color={colors.teal} size={15} />
    </Pressable>}
  </View>;
}
const s = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'stretch', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.border },
  current: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9 },
  progress: { fontFamily: fonts.body, fontSize: 10, lineHeight: 15, color: colors.muted },
  currentTitle: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 19, color: colors.ink },
  next: { minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 3, borderLeftWidth: 1, borderLeftColor: colors.border },
  nextLabel: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 19, color: '#087c76' },
  overlay: { flex: 1, justifyContent: 'flex-start', backgroundColor: 'rgba(27,37,54,0.38)' },
  sheet: { maxHeight: '90%', backgroundColor: colors.paper, borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20, marginHorizontal: 8, overflow: 'hidden' },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', padding: 18, paddingBottom: 6 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: fonts.body, fontSize: 27, color: colors.muted },
});
