import { createContext, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { useApp } from '../state/AppState';
import { cacheGeneration } from '../native/cache';
import { chapterHaptic } from '../native/haptics';
import { readReaderPosition, readerPosition, saveReaderPosition, type ReaderPosition } from '../native/readerPosition';
import { Icon } from './BrandArt';
import { Page, colors, fonts, type PageProps } from './ui';

import { ReadingNavigation } from './ReadingNavigation';
import type { ContentsItem } from './ChapterContents';
import { useReadingProgress } from '../state/useReadingProgress';

export type ReaderItem = ContentsItem;
interface Anchor { y: number; height: number }
interface ReaderController {
  items: ReaderItem[]; openKey: string | null; activeKey: string | null;
  contentsOpen: boolean; setContentsOpen: (open: boolean) => void;
  complete: (key: string) => void;
  select: (key: string) => void; toggle: (key: string, open: boolean) => void;
  onSectionLayout: (key: string, open: boolean, event: LayoutChangeEvent) => void;
  register: (items: ReaderItem[], scope: string, ready: boolean) => void;
}
const ReaderContext = createContext<ReaderController | null>(null);
export const useReader = () => useContext(ReaderContext);

/** Section metadata only: this controller never stores reading text or rights. */
export function useReaderSections(items: ReaderItem[], scope: string, ready = true) {
  const reader = useContext(ReaderContext);
  const register = reader?.register;
  const signature = JSON.stringify(items);
  const stableItems = useMemo<ReaderItem[]>(() => JSON.parse(signature), [signature]);
  useEffect(() => { register?.(stableItems, scope, ready); }, [register, stableItems, scope, ready]);
  useEffect(() => () => { register?.([], '', false); }, [register]);
  return reader;
}

interface ReaderPageProps extends PageProps {
  readerKey: string; positionKey?: string; publicExample?: boolean;
  restorePosition?: boolean; initialSection?: string; fallbackSection?: string;
  contentsTitle?: string;
}
export function ReaderPage({ readerKey, positionKey = readerKey, publicExample = false, ...props }: ReaderPageProps) {
  const { session, base } = useApp();
  const userId = session?.user.id, deleting = !!session?.deletion, epoch = cacheGeneration();
  const position = useMemo(() => readerPosition(positionKey, { userId, deleting, base }, publicExample, epoch), [positionKey, userId, deleting, base, publicExample, epoch]);
  // Remount before another owner's/report's children can receive the old open key.
  return <ReaderPageState key={JSON.stringify([readerKey, position?.key, epoch])} position={position} progressKey={positionKey} {...props} />;
}
function ReaderPageState({ position, progressKey, contentsTitle, restorePosition = true, initialSection, fallbackSection, scrollRef: externalRef, onScroll: externalScroll, onContentSizeChange: externalSize, footer, ...props }: Omit<ReaderPageProps, 'readerKey' | 'positionKey' | 'publicExample'> & { position: ReaderPosition | null; progressKey: string }) {
  const { readKeys, complete: saveComplete } = useReadingProgress(progressKey);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  useImperativeHandle(externalRef, () => scrollRef.current!, []);
  const [items, setItems] = useState<ReaderItem[]>([]);
  const [itemsReady, setItemsReady] = useState(false);
  const registeredReady = useRef(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [contentsOpen, setContentsOpen] = useState(false);
  const restored = useRef(false);
  const anchors = useRef(new Map<string, Anchor>());
  const scope = useRef('');
  const pending = useRef<{ key: string; ready: boolean } | null>(null);
  const frame = useRef<number | null>(null);
  const cancelJump = useCallback(() => {
    pending.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  useEffect(() => cancelJump, [cancelJump]);
  const register = useCallback((next: ReaderItem[], nextScope: string, ready: boolean) => {
    if (scope.current !== nextScope) {
      // An access/schema change must not resurrect a pending stored selection.
      if (scope.current && registeredReady.current) restored.current = true;
      scope.current = nextScope;
      // Owner/report changes remount ReaderPage. Within this report, a rights
      // refresh must not close a chapter the reader chose while loading.
      const stillAvailable = (key: string | null) => next.some(item => item.key === key && !item.locked);
      if (!pending.current || !stillAvailable(pending.current.key)) cancelJump();
      setOpenKey(key => stillAvailable(key) ? key : null);
      setActiveKey(key => stillAvailable(key) ? key : null);
      setContentsOpen(false);
    }
    registeredReady.current = ready; setItemsReady(ready);
    setItems(next);
  }, [cancelJump]);
  const jumpAfterLayout = useCallback(() => {
    if (!pending.current) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const target = pending.current;
      if (!target?.ready) return;
      const anchor = anchors.current.get(target.key);
      if (!anchor || !scrollRef.current) return;
      pending.current = null;
      // A contents jump is immediate: animating past a collapsing long section
      // exposes intermediate offsets that no longer belong to the new layout.
      scrollRef.current.scrollTo({ y: Math.max(0, anchor.y - 12), animated: false });
      setActiveKey(target.key);
    });
  }, []);
  const select = useCallback((key: string) => {
    if (!items.some(item => item.key === key)) return;
    if (key !== openKey) chapterHaptic();
    restored.current = true;
    void saveReaderPosition(position, key);
    pending.current = { key, ready: openKey === key };
    setOpenKey(key); setActiveKey(key); setContentsOpen(false);
    jumpAfterLayout();
  }, [items, openKey, jumpAfterLayout, position]);
  useEffect(() => {
    if (restored.current || !items.length || !itemsReady || !restorePosition) return;
    let live = true;
    const selection = initialSection ? Promise.resolve(initialSection) : readReaderPosition(position);
    void selection.then(chapter => {
      if (!live || restored.current) return;
      restored.current = true;
      const item = items.find(item => item.key === (chapter ?? fallbackSection));
      // A bookmark does not grant access, and a formerly paid chapter stays closed.
      if (item && (!item.locked || initialSection === item.key)) select(item.key);
      else if (fallbackSection) {
        const fallback = items.find(item => item.key === fallbackSection && !item.locked);
        if (fallback) select(fallback.key);
      }
    });
    return () => { live = false; };
  }, [items, itemsReady, restorePosition, initialSection, fallbackSection, position, select]);
  const toggle = useCallback((key: string, open: boolean) => {
    if (open) select(key);
    else { cancelJump(); setOpenKey(null); setActiveKey(key); }
  }, [select, cancelJump]);
  const onSectionLayout = useCallback((key: string, open: boolean, event: LayoutChangeEvent) => {
    anchors.current.set(key, event.nativeEvent.layout);
    if (pending.current?.key === key && open) pending.current.ready = true;
    jumpAfterLayout();
  }, [jumpAfterLayout]);
  const complete = (key: string) => {
    if (items.some(item => item.key === key && !item.locked) && !readKeys.includes(key)) void saveComplete(key);
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    externalScroll?.(event);
    if (pending.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    let current: string | null = null;
    for (const item of items) {
      const anchor = anchors.current.get(item.key);
      if (anchor && anchor.y <= contentOffset.y + 32) current = item.key;
    }
    // A short final/locked section cannot always reach the top of the viewport.
    const opened = openKey ? anchors.current.get(openKey) : undefined;
    if (opened && contentOffset.y + layoutMeasurement.height >= contentSize.height - 2
      && opened.y < contentOffset.y + layoutMeasurement.height && opened.y + opened.height > contentOffset.y) current = openKey;
    if (opened && openKey && contentOffset.y < opened.y + opened.height
      && contentOffset.y + layoutMeasurement.height >= opened.y + opened.height) complete(openKey);
    setActiveKey(previous => previous === current ? previous : current);
  };
  const reader: ReaderController = { items, openKey, activeKey, contentsOpen, setContentsOpen, complete, select, toggle, onSectionLayout, register };
  return <ReaderContext.Provider value={reader}>
    <Page {...props} scrollRef={scrollRef} onScroll={onScroll} onContentSizeChange={(width, height) => { externalSize?.(width, height); jumpAfterLayout(); }}
      footer={<>{footer}{items.length > 0 && <ReadingNavigation items={items} activeKey={activeKey} contentsOpen={contentsOpen}
        onContents={setContentsOpen} onSelect={select} readKeys={readKeys} title={contentsTitle} />}</>} />
  </ReaderContext.Provider>;
}

export function ReaderContentsButton() {
  const reader = useContext(ReaderContext);
  const { t } = useApp();
  if (!reader) return null;
  return <Pressable testID="reader-contents-inline" accessibilityRole="button" onPress={() => reader.setContentsOpen(true)} style={s.contentsButton}>
    <Icon name="book" color={colors.teal} size={24} /><View style={{ flex: 1, gap: 2 }}>
      <Text style={s.buttonLabel}>{t('Оглавление разбора', 'Reading contents')}</Text>
      <Text style={s.hint}>{t('Выберите раздел для чтения', 'Choose a section to read')}</Text>
    </View><Icon name="arrow" color={colors.gold} size={17} />
  </Pressable>;
}
/** Place directly in the Page scroll content so y is a content coordinate. */
export function ReaderAnchor({ sectionKey, children }: { sectionKey: string; children: ReactNode }) {
  const reader = useContext(ReaderContext);
  return <View testID={`reader-section-${sectionKey}`} onLayout={event => reader?.onSectionLayout(sectionKey, reader.openKey === sectionKey, event)}>{children}</View>;
}
export function ReaderSectionEnd({ sectionKey }: { sectionKey: string }) {
  const reader = useContext(ReaderContext);
  const { t } = useApp();
  if (!reader) return null;
  const next = reader.items[reader.items.findIndex(item => item.key === sectionKey) + 1];
  return <View style={s.sectionEnd}>
    <Pressable accessibilityRole="button" onPress={() => { reader.complete(sectionKey); reader.setContentsOpen(true); }} style={s.endContents}><Icon name="book" color={colors.teal} size={19} /><Text style={s.buttonLabel}>{t('К оглавлению', 'Back to contents')}</Text></Pressable>
    {next && <Pressable testID={`reader-next-${sectionKey}`} accessibilityRole="button" accessibilityLabel={`${t('Далее', 'Next')}: ${next.title}`}
      onPress={() => { reader.complete(sectionKey); reader.select(next.key); }} style={s.endNext}>
      <View style={{ flex: 1, gap: 4 }}><Text style={s.progress}>{t('Следующий раздел', 'Next section')}</Text><Text style={s.itemTitle}>{next.title}</Text></View>
      <Icon name={next.locked ? 'lock' : 'arrow'} color={colors.gold} size={18} />
    </Pressable>}
  </View>;
}
const s = StyleSheet.create({
  contentsButton: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  buttonLabel: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: '#087c76' },
  hint: { fontFamily: fonts.body, fontSize: 11, lineHeight: 17, color: colors.muted },
  progress: { fontFamily: fonts.body, fontSize: 10, lineHeight: 15, color: colors.muted },
  itemTitle: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: colors.ink },
  sectionEnd: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 8 },
  endContents: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  endNext: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, backgroundColor: colors.card2, borderRadius: 10 },
});
