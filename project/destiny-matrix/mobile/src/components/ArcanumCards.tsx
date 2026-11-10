import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArcanumImage } from './ArcanumImage';
import { useNavigate } from './AppLink';
import { colors, fonts } from './ui';

export interface ArcanumCardItem { arcanum: number; label: string; href?: string }

/** The same deck and captions as the website, measured inside their actual panel. */
export function ArcanumCards({ cards, columns, maxWidth = 150 }: {
  cards: ArcanumCardItem[]; columns?: 1 | 2 | 3 | 4; maxWidth?: number;
}) {
  const navigate = useNavigate();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(280);
  const count = columns ?? (cards.length === 1 ? 1 : cards.length === 3 && width / Math.max(1, fontScale) >= 330 ? 3 : 2);
  // Leave one logical pixel per cell for Yoga's device-pixel rounding.
  const cellWidth = Math.max(40, Math.floor((width - (count - 1) * 12) / count) - 1);
  return <View testID="arcanum-grid" style={s.grid} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {cards.map((card, i) => {
      const label = new RegExp(`^${card.arcanum}(?:\\s|$)`).test(card.label) ? card.label : `${card.arcanum} · ${card.label}`;
      return <Pressable key={`${card.arcanum}-${i}`} accessibilityRole={card.href ? 'link' : undefined}
        accessibilityLabel={label} disabled={!card.href} testID={`arcanum-card-${card.arcanum}-${i}`}
        onPress={() => { if (card.href) void navigate(card.href).catch(error => Alert.alert(String(error.message))); }}
        style={[s.cell, { width: cellWidth }]}>
        <ArcanumImage n={card.arcanum} width={Math.min(maxWidth, cellWidth)} decorative />
        <Text style={s.caption}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', width: '100%', paddingVertical: 8 },
  cell: { alignItems: 'center', gap: 9, minWidth: 0, paddingBottom: 6 },
  caption: { fontFamily: fonts.display, fontSize: 18, lineHeight: 21, color: colors.ink, textAlign: 'center' },
});
