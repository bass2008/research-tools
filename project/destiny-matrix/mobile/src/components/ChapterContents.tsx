import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppState';
import { chapterTitle } from '../native/personalReading';
import { ArcanumImage } from './ArcanumImage';
import { Icon } from './BrandArt';
import { colors, fonts } from './ui';

export interface ContentsItem {
  key: string; title: string; locked?: boolean; positions?: { arcanum: number }[];
}

export function ChapterFan({ section }: { section: ContentsItem }) {
  const cards = section.positions ?? [];
  return <View accessible={false} style={{ width: 56, height: 49, justifyContent: 'center' }}>
    {cards.map((card, index) => <View key={index} style={{ position: 'absolute',
      left: cards.length > 1 ? index * 26 / (cards.length - 1) : 8,
      transform: [{ rotate: `${cards.length > 1 ? -12 + index * 24 / (cards.length - 1) : 0}deg` }] }}>
      <ArcanumImage n={card.arcanum} width={30} decorative />
    </View>)}
  </View>;
}

export function ChapterContents({ sections, readKeys = [], selected, onSelect, order = sections }: {
  sections: ContentsItem[]; order?: ContentsItem[]; readKeys?: string[]; selected?: string;
  onSelect?: (key: string) => void;
}) {
  const { t } = useApp();
  return <View testID="chapter-contents">
    {sections.map(section => {
      const title = chapterTitle(section.title);
      const index = order.findIndex(item => item.key === section.key);
      const read = !section.locked && readKeys.includes(section.key);
      const status = section.locked ? t('Закрыта', 'Locked')
        : read ? t('Прочитана', 'Read') : t('Открыта', 'Open');
      const content = <>
        <Text style={s.number}>{String(index + 1).padStart(2, '0')}</Text>
        <ChapterFan section={section} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.title}>{title}</Text>
          <Text style={[s.status, read && { color: '#087b75' }]}>{status}</Text>
        </View>
        <Icon name={section.locked ? 'lock' : 'arrow'}
          size={15} color={section.locked ? colors.gold : '#087b75'} />
      </>;
      const style = [s.row, selected === section.key && { backgroundColor: colors.card2 }];
      return onSelect ? <Pressable key={section.key} testID={`contents-${section.key}`}
        accessibilityRole="button" accessibilityLabel={`${index + 1}. ${title}. ${status}`}
        accessibilityState={{ selected: selected === section.key }}
        onPress={() => onSelect(section.key)} style={style}>{content}</Pressable>
        : <View key={section.key} style={style}>{content}</View>;
    })}
  </View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13,
    borderBottomWidth: 1, borderColor: colors.border, minHeight: 78 },
  number: { width: 25, fontFamily: fonts.display, fontSize: 23, color: '#8c6c29' },
  title: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: '#243632' },
  status: { fontFamily: fonts.body, fontSize: 10, lineHeight: 16, color: colors.muted },
});
