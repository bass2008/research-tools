import { Text, View } from 'react-native';
import { usePalette } from '../state/Design';
import { ArcanumImage } from './ArcanumImage';
import { fonts, styles } from './ui';

export function Kicker({ children }: { children: string }) {
  const p = usePalette();
  return <Text style={[styles.eyebrow, { color: p.accent }]}>{children}</Text>;
}
export function DisplayTitle({ children, center = false }: { children: string; center?: boolean }) {
  const p = usePalette();
  return <Text accessibilityRole="header" style={{ fontFamily: fonts.display,
    fontSize: 38, lineHeight: 43, letterSpacing: -0.6,
    color: p.ink, textAlign: center ? 'center' : 'left', paddingBottom: 3 }}>{children}</Text>;
}
export function DeckStill({ large = false }: { large?: boolean }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 12 }}>
    <View style={{ transform: [{ rotate: '-12deg' }, { translateX: 13 }, { translateY: 7 }] }}><ArcanumImage n={2} width={large ? 94 : 66} decorative /></View>
    <View style={{ zIndex: 2, transform: [{ translateY: -5 }], boxShadow: '0 8px 20px -7px #3f382e66' }}><ArcanumImage n={17} width={large ? 114 : 80} decorative /></View>
    <View style={{ transform: [{ rotate: '12deg' }, { translateX: -13 }, { translateY: 7 }] }}><ArcanumImage n={21} width={large ? 94 : 66} decorative /></View>
  </View>;
}
