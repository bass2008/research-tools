import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useApp } from '../state/AppState';
import { arcanumTitle } from '../daily/arcanumTitles';
import { dailyContent } from '../daily/content';
import { ArcanumImage } from './ArcanumImage';
import { BrandLogo } from './BrandArt';
import { MatrixMap } from './MatrixMap';
import { Action, Body, colors, fonts } from './ui';

type ShareContent = { kind: 'daily'; arcanum: number }
  | { kind: 'matrix'; birth: string; points: Record<string, number> };

export function ShareCard({ content }: { content: ShareContent }) {
  const { t, locale } = useApp();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const window = useWindowDimensions();
  const width = Math.min(360, window.width - 40, (window.height - 205) * 9 / 16);
  const scale = width / 360;
  const daily = content.kind === 'daily' ? dailyContent(locale, content.arcanum) : null;
  const label = content.kind === 'daily'
    ? t('Поделиться темой дня', 'Share today’s theme') : t('Поделиться моей матрицей', 'Share my matrix');
  async function share() {
    if (!await Sharing.isAvailableAsync()) throw new Error(t('На этом устройстве нельзя поделиться картинкой.', 'Image sharing is unavailable on this device.'));
    const uri = await captureRef(ref, { width: 1080, height: 1920, format: 'png', result: 'tmpfile' });
    try { await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: label }); }
    finally { releaseCapture(uri); }
  }
  return <>
    <Pressable testID={`share-${content.kind}-open`} accessibilityRole="button" accessibilityLabel={label}
      onPress={() => { setLoaded(false); setLaidOut(false); setOpen(true); }} style={s.link}>
      <Text style={s.linkText}>{t('Поделиться', 'Share')} ↗</Text>
    </Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <Text style={s.heading}>{t('Карточка', 'Share card')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Закрыть', 'Close')}
            onPress={() => setOpen(false)} style={s.close}>
            <Text style={s.closeText}>×</Text>
          </Pressable>
        </View>
        <View ref={ref} collapsable={false} testID={`share-${content.kind}-card`}
          onLayout={() => setLaidOut(true)} style={[s.card, { width, height: width * 16 / 9, padding: 26 * scale }]}>
          <View style={{ alignItems: 'center', gap: 10 * scale }}>
            <Text allowFontScaling={false} style={[s.kicker, { fontSize: 10 * scale }]}>
              {content.kind === 'daily' ? t('ТЕМА ДНЯ', 'TODAY’S THEME') : t('МОЯ МАТРИЦА', 'MY MATRIX')}
            </Text>
            {content.kind === 'matrix' && <Text allowFontScaling={false} style={[s.title, { fontSize: 35 * scale }]}>
              {content.birth.split('-').reverse().join('.')}
            </Text>}
          </View>
          {content.kind === 'daily' && daily ? <>
            <ArcanumImage n={content.arcanum} width={172 * scale} decorative onLoad={() => setLoaded(true)} />
            <View style={{ gap: 10 * scale, alignItems: 'center' }}>
              <Text allowFontScaling={false} style={[s.kicker, { fontSize: 11 * scale, letterSpacing: 0.4 }]}>
                {content.arcanum} · {arcanumTitle(locale, content.arcanum)}
              </Text>
              <Text allowFontScaling={false} style={[s.title, { fontSize: 30 * scale, lineHeight: 33 * scale }]}>
                {daily.title}
              </Text>
            </View>
            <Text allowFontScaling={false} style={[s.question, { fontSize: 15 * scale, lineHeight: 23 * scale }]}>
              {daily.question}
            </Text>
          </> : content.kind === 'matrix' && <View pointerEvents="none" style={{ width: width - 24 * scale }}>
            <MatrixMap points={content.points} miniature />
          </View>}
          <View style={{ borderTopWidth: 1, borderColor: '#d9c9ac', paddingTop: 14 * scale,
            alignItems: 'center', width: '100%' }}>
            <BrandLogo />
          </View>
        </View>
        <View style={s.actions}>
          <Action testID={`share-${content.kind}-send`} title={t('Поделиться', 'Share')}
            disabled={!laidOut || content.kind === 'daily' && !loaded} onPress={share} />
          {content.kind === 'matrix' && <Body muted>{t('На карточке будет ваша дата рождения.', 'The card includes your birth date.')}</Body>}
        </View>
      </SafeAreaView>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingVertical: 10 },
  linkText: { fontFamily: fonts.bold, fontSize: 13, color: colors.teal },
  screen: { flex: 1, backgroundColor: '#e8e3d8', alignItems: 'center', justifyContent: 'space-between' },
  header: { width: '100%', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', minHeight: 50 },
  heading: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  closeText: { fontSize: 30, color: colors.muted },
  card: { backgroundColor: '#faf5e9', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#d9c9ac' },
  kicker: { fontFamily: fonts.bold, color: '#967941', letterSpacing: 2, textAlign: 'center' },
  title: { fontFamily: fonts.display, color: '#243632', textAlign: 'center' },
  question: { fontFamily: fonts.body, color: '#4f5b50', textAlign: 'center' },
  actions: { width: '100%', paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
});
