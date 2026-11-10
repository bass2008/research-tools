import { useContext, useState, type ReactNode, type Ref } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance, type ScrollViewProps, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppState';
import { useNavigate } from './AppLink';
import { DesignSurface, useDesign, usePalette, type DesignScene } from '../state/Design';

export const colors = { ink: '#1b2536', muted: '#6c6d72', teal: '#0e8f88', bg: '#f1ebdf', border: '#e2d6bd', white: '#ffffff', error: '#9e3434', paper: '#fffdf8', gold: '#b8902a', card2: '#faf6ec' };
export const fonts = { body: 'Manrope-Regular', bold: 'Manrope-Bold', display: 'CormorantGaramond-SemiBold' };
export const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 18, paddingBottom: 30, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.ink, lineHeight: 40, paddingBottom: 3 },
  heading: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, lineHeight: 33, paddingBottom: 2 },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 20, color: colors.muted },
  eyebrow: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 16, letterSpacing: 1.4, textTransform: 'uppercase', color: '#087c76' },
  card: { backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12, boxShadow: '0 7px 20px -12px rgba(70,50,15,0.2)' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  input: { minHeight: 48, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 16, color: colors.ink, backgroundColor: colors.white },
  label: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted, lineHeight: 17 },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: colors.teal, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 21, color: colors.white },
  link: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: '#087c76' },
  error: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.error },
});
export interface PageProps {
  title?: string; children: ReactNode; tab?: boolean; scrollRef?: Ref<ScrollViewInstance>;
  onScroll?: ScrollViewProps['onScroll']; onContentSizeChange?: ScrollViewProps['onContentSizeChange']; footer?: ReactNode;
  header?: ReactNode;
  scene?: DesignScene;
}
export function Page({ title, children, tab = false, scrollRef, onScroll, onContentSizeChange, footer, header, scene }: PageProps) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const { design } = useDesign(); const { locale } = useApp();
  // The tab bar owns its bottom inset. Stack pages must keep their whole viewport above system navigation.
  return <DesignSurface kind="canvas"><SafeAreaView testID={scene ? `design-ready-atelier-${scene}-${locale}` : undefined} style={{ flex: 1, backgroundColor: design.background }} edges={tab ? ['top', 'left', 'right'] : ['left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
    {header}
    <ScrollView ref={scrollRef} contentContainerStyle={[styles.page, { gap: design.spacing }]} keyboardShouldPersistTaps="handled"
      onScroll={onScroll} scrollEventThrottle={onScroll ? 16 : undefined} onContentSizeChange={onContentSizeChange}>
      {title && <Text accessibilityRole="header" style={[styles.title, { color: design.ink }]}>{title}</Text>}{children}
    </ScrollView>
    {footer}
    </KeyboardAvoidingView>
  </SafeAreaView></DesignSurface>;
}
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { design } = useDesign();
  return <DesignSurface kind="paper"><View style={[styles.card, { backgroundColor: design.paper, borderColor: design.border, borderRadius: design.radius }, style]}>{children}</View></DesignSurface>;
}
export const Paper = Card;
export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) { const p = usePalette(); return <Text style={[muted ? styles.muted : styles.text, { color: muted ? p.muted : p.ink }]}>{children}</Text>; }
export function Heading({ children }: { children: ReactNode }) { const p = usePalette(); return <Text accessibilityRole="header" style={[styles.heading, { color: p.ink }]}>{children}</Text>; }
export function Action({ title, onPress, testID, disabled, secondary = false, tone = 'teal' }: {
  title: string; onPress: () => void | Promise<void>; testID?: string; disabled?: boolean; secondary?: boolean; tone?: 'teal' | 'gold';
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { design } = useDesign(); const palette = usePalette();
  return <View style={{ gap: 8 }}><Pressable accessibilityRole="button" accessibilityLabel={title} testID={testID} disabled={disabled || busy}
    accessibilityState={{ disabled: disabled || busy, busy }} onPress={() => {
      setError(''); setBusy(true);
      void Promise.resolve().then(onPress).catch(e => setError(e instanceof Error ? e.message : String(e))).finally(() => setBusy(false));
    }} style={({ pressed }) => [styles.button, { borderRadius: 5, backgroundColor: tone === 'gold' ? design.gold : design.accent }, secondary ? { backgroundColor: 'transparent', borderColor: design.border, borderWidth: 1 } : { boxShadow: '0 5px 12px -6px rgba(70,50,15,0.4)' }, (disabled || busy) && { opacity: 0.55 }, pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] }]}>
      <Text style={[styles.buttonText, { textAlign: 'center', color: secondary ? palette.ink : tone === 'gold' ? colors.ink : colors.white }, busy && { opacity: 0 }]}>{title}</Text>
      {busy && <ActivityIndicator style={{ position: 'absolute' }} color={secondary ? palette.ink : tone === 'gold' ? colors.ink : colors.white} />}
    </Pressable>{error ? <Text accessibilityRole="alert" style={[styles.error, { color: palette.error }]}>{error}</Text> : null}</View>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  const palette = usePalette();
  return <View style={{ gap: 6, flexGrow: 1 }}><Text style={[styles.label, { color: palette.muted }]}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#686b66" selectionColor={colors.teal} {...props}
    onFocus={e => { setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }}
    style={[styles.input, focused && { borderColor: colors.teal, backgroundColor: '#f7fcfb' }, props.style]} /></View>;
}
export function Segments<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: { value: T; label: string; testID?: string }[] }) {
  return <View style={{ flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: '#e9e3d7', gap: 4 }}>
    {options.map(option => <Pressable key={option.value} testID={option.testID} accessibilityRole="button" accessibilityState={{ selected: value === option.value }} onPress={() => onChange(option.value)}
      style={({ pressed }) => ({ flex: 1, minHeight: 42, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 9, backgroundColor: value === option.value ? colors.paper : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ fontFamily: value === option.value ? fonts.bold : fonts.body, fontSize: 12.5, color: value === option.value ? colors.ink : colors.muted, textAlign: 'center' }}>{option.label}</Text>
    </Pressable>)}
  </View>;
}
export function RemoteStatus({ loading, error, offline, reload }: { loading: boolean; error?: string; offline?: boolean; reload: () => void }) {
  const { t } = useApp();
  return <>{loading && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}><ActivityIndicator accessibilityLabel={t('Загрузка', 'Loading')} color={colors.teal} /><Body muted>{t('Загрузка…', 'Loading…')}</Body></View>}
    {error && <Card><Text style={styles.eyebrow}>{t('Не удалось загрузить', 'Unable to load')}</Text><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Action title={t('Повторить', 'Retry')} onPress={reload} secondary /></Card>}
    {offline && <DesignSurface kind="paper"><View style={{ borderLeftWidth: 2, borderLeftColor: colors.gold, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: colors.card2, borderRadius: 4 }}><Body muted>{t('Сохранённая версия · нет связи с сервером', 'Saved version · server unavailable')}</Body></View></DesignSurface>}</>;
}
export function RichText({ text }: { text: string }) {
  const navigate = useNavigate();
  const palette = usePalette();
  return <Text selectable style={[styles.text, { color: palette.ink }]}>{text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(\/[^)\s]*\))/g).map((part, i) => {
    const link = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/.exec(part);
    if (link) return <Text key={i} accessibilityRole="link" style={[styles.link, { color: palette.accent }]} onPress={() => { void navigate(link[2]); }}>{link[1]}</Text>;
    return part.startsWith('**') ? <Text key={i} style={{ fontFamily: fonts.bold }}>{part.slice(2, -2)}</Text> : part;
  })}</Text>;
}
