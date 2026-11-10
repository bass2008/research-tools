import { Pressable, Text, View } from 'react-native';
import { colors, fonts, styles } from './ui';
import { Entrance } from './Entrance';
import { usePalette } from '../state/Design';

export function ResultHeading({ title, eyebrow, editLabel, onEdit }: { title: string; eyebrow: string; editLabel: string; onEdit: () => void }) {
  const p = usePalette();
  return <Entrance><View testID="calculation-result" style={{ gap: 6 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={[styles.eyebrow, { flex: 1, color: p.accent }]}>{eyebrow}</Text>
      <Pressable accessibilityRole="button" testID="edit-calculation" onPress={onEdit}
        style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.paper, opacity: pressed ? 0.65 : 1 })}>
        <Text style={{ fontFamily: fonts.bold, color: '#087c76', fontSize: 12, lineHeight: 18 }}>{editLabel}</Text>
      </Pressable>
    </View>
    <Text accessibilityRole="header" style={[styles.title, { color: p.ink, fontSize: 38, lineHeight: 43 }]}>{title}</Text>
  </View></Entrance>;
}
