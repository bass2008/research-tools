import { Text, View, useWindowDimensions, type ColorValue } from 'react-native';
import { useState } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { ArcanumImage } from './ArcanumImage';
import { colors, fonts, styles } from './ui';
import { useDesign } from '../state/Design';

export type IconName = 'matrix' | 'pair' | 'year' | 'book' | 'account' | 'settings' | 'arrow' | 'lock';
export function Icon({ name, color = colors.muted, size = 22 }: { name: IconName; color?: ColorValue; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    <G fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {name === 'matrix' && <><Path d="M12 2 22 12 12 22 2 12Z" /><Rect x={5} y={5} width={14} height={14} rx={1} /><Circle cx={12} cy={12} r={2.5} /></>}
      {name === 'pair' && <><Circle cx={8} cy={10} r={5} /><Circle cx={16} cy={14} r={5} /></>}
      {name === 'year' && <><Rect x={3} y={5} width={18} height={16} rx={3} /><Path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2" /></>}
      {name === 'book' && <><Path d="M12 5C9 2 5 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-7-2-10 1Z M12 5v16" /><Path d="M5 8h4M5 12h4M15 8h4M15 12h4" /></>}
      {name === 'account' && <><Circle cx={12} cy={8} r={4} /><Path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
      {name === 'settings' && <><Circle cx={12} cy={12} r={3} /><Path d="m9 3 1-2h4l1 2 2 1 2-.1 2 3-1 2v3l1 2-2 3-2-.1-2 1-1 2h-4l-1-2-2-1-2 .1-2-3 1-2v-3L3 7l2-3 2 .1Z" transform="translate(1 1) scale(.9)" /></>}
      {name === 'arrow' && <Path d="m9 5 7 7-7 7" />}
      {name === 'lock' && <><Rect x={5} y={10} width={14} height={11} rx={2} /><Path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>}
    </G>
  </Svg>;
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  const { design } = useDesign();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }} accessibilityLabel="Arcana Sense">
    <Svg width={34} height={34} viewBox="0 0 52 52" accessible={false}>
      <Circle cx={26} cy={26} r={23} stroke={colors.gold} strokeWidth={1.1} fill="none" />
      <Circle cx={26} cy={26} r={19} stroke={colors.gold} strokeWidth={0.7} strokeDasharray="2 4" fill="none" />
      <SvgText x={26} y={34} textAnchor="middle" fontFamily={fonts.display} fontSize={25} fill={colors.teal}>AS</SvgText>
    </Svg>
    {!compact && <Text maxFontSizeMultiplier={1} style={{ fontFamily: fonts.display, fontSize: 23, color: design.chromeInk }}>Arcana Sense</Text>}
  </View>;
}

export function CardFan({ cards = [2, 6, 10, 1, 14, 18, 21], compact = false }: { cards?: number[]; compact?: boolean }) {
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen - 48, 430);
  const cardWidth = Math.min(compact ? 62 : 76, width / 4.8);
  const step = Math.min(cardWidth * 0.7, (width - cardWidth * 1.3) / Math.max(1, cards.length - 1));
  return <View testID="card-fan" accessible={false} importantForAccessibility="no-hide-descendants"
    style={{ width, alignSelf: 'center', height: cardWidth * 1.65 + 10, marginTop: compact ? 2 : 12 }}>
    {cards.map((n, i) => {
      const off = i - (cards.length - 1) / 2;
      return <View key={`${n}-${i}`} style={{ position: 'absolute', top: Math.abs(off) ** 2 * 2.2, left: width / 2 - cardWidth / 2 + off * step,
        zIndex: 20 - Math.abs(off), transform: [{ rotate: `${off * 6.5}deg` }], borderRadius: 7, boxShadow: '0 9px 14px -7px rgba(18,40,60,0.4)' }}>
        <ArcanumImage n={n} width={cardWidth} decorative />
      </View>;
    })}
  </View>;
}

export function ScreenHero({ title, eyebrow, cards, compact = false }: { title: string; eyebrow?: string; cards?: number[]; compact?: boolean }) {
  const [height, setHeight] = useState(300);
  return <View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={{ marginHorizontal: -18, marginTop: -18, padding: 18, paddingBottom: 20, gap: 8, overflow: 'hidden' }}>
    <Svg width="100%" height={height} style={{ position: 'absolute', top: 0, left: 0 }} accessible={false}>
      <Defs><LinearGradient id="brand-sky" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#e4eeea" /><Stop offset="1" stopColor="#f1ebdf" /></LinearGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#brand-sky)" />
    </Svg>
    <CardFan cards={cards} compact={compact} />
    {eyebrow && <Text style={[styles.eyebrow, { textAlign: 'center' }]}>{eyebrow}</Text>}
    <Text testID="screen-title" accessibilityRole="header" style={[styles.title, { textAlign: 'center', fontSize: compact ? 30 : 34, lineHeight: compact ? 38 : 42 }]}>{title}</Text>
  </View>;
}
