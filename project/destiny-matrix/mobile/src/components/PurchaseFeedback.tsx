import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CardFan, Icon } from './BrandArt';
import { Action, colors, fonts, styles } from './ui';
import { DesignSurface } from '../state/Design';

/** Payment results occupy their own page, with a single next step into reading. */
export function PurchaseComplete({ cards, eyebrow, title, description, context, facts, note, action, onRead }: {
  cards: number[]; eyebrow: string; title: string; description: string; context?: string;
  facts: string[]; note?: string; action: string; onRead: () => void;
}) {
  return <DesignSurface kind="paper"><View testID="purchase-complete" style={s.paper}>
    <View style={s.art}><CardFan compact cards={cards} /></View>
    <View style={s.seal}><Icon name="book" size={18} color={colors.teal} /><Text style={[styles.eyebrow, s.sealText]}>{eyebrow}</Text></View>
    <Text accessibilityRole="header" style={s.title}>{title}</Text>
    <Text style={[styles.text, s.center]}>{description}</Text>
    {context && <Text style={s.context}>{context}</Text>}
    <Action testID="purchase-read" title={action} onPress={onRead} />
    <View style={s.facts}>{facts.map(fact => <View key={fact} style={s.fact}>
      <Text accessible={false} style={s.check}>✓</Text><Text style={[styles.text, s.factText]}>{fact}</Text>
    </View>)}</View>
    {note && <Text style={[styles.muted, s.center]}>{note}</Text>}
  </View></DesignSurface>;
}

export function PurchaseNotice({ title, description, detail, waiting = false, error = false, children }: {
  title: string; description: string; detail?: string; waiting?: boolean; error?: boolean; children?: ReactNode;
}) {
  return <DesignSurface kind="paper"><View testID={waiting ? 'purchase-waiting' : 'purchase-notice'} style={[s.notice, error && s.failure]}>
    {waiting ? <ActivityIndicator accessibilityLabel={title} color={colors.teal} size="large" />
      : <View style={s.mark}><Icon name={error ? 'lock' : 'book'} color={error ? colors.error : colors.teal} size={25} /></View>}
    <Text accessibilityRole="header" style={[styles.heading, s.center]}>{title}</Text>
    <Text style={[styles.text, s.center]}>{description}</Text>
    {detail && <Text accessibilityRole={error ? 'alert' : undefined} style={[error ? styles.error : styles.muted, s.center]}>{detail}</Text>}
    {children}
  </View></DesignSurface>;
}

const s = StyleSheet.create({
  paper: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 22, gap: 18,
    boxShadow: '0 12px 28px -16px rgba(70,50,15,0.25)' },
  art: { marginHorizontal: -22, alignItems: 'center', overflow: 'hidden' },
  seal: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sealText: { flexShrink: 1, textAlign: 'center' },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 34, lineHeight: 40, textAlign: 'center' },
  center: { textAlign: 'center' },
  context: { fontFamily: fonts.display, color: colors.ink, fontSize: 24, lineHeight: 31, textAlign: 'center' },
  facts: { gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 18 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  factText: { flex: 1 },
  check: { color: colors.gold, fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 },
  notice: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 22, gap: 16 },
  failure: { borderColor: '#dec5bb' },
  mark: { alignSelf: 'center', padding: 13, borderRadius: 30, backgroundColor: colors.card2 },
});
