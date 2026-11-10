import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { D } from '@/lib/i18n';
import { arcanumTitle } from '../daily/arcanumTitles';
import { useApp } from '../state/AppState';
import { useDesign } from '../state/Design';
import { useNavigate } from './AppLink';
import { ArcanumImage } from './ArcanumImage';
import { Icon } from './BrandArt';
import { TabHeading } from './TabHeading';
import { Body, Heading, fonts } from './ui';

interface LibraryLink { href: string; label: string }
type Kind = keyof typeof D.encSections;
const topicCards: Partial<Record<Kind, number>> = {
  arc: 1, sec: 2, pts: 17, chk: 14, tls: 9, yer: 10, cmp: 6, ptl: 15, cmb: 21, art: 5,
};

export function LibraryTopics({ links }: { links: LibraryLink[] }) {
  const { locale, t } = useApp();
  const { design } = useDesign();
  const navigate = useNavigate();
  const { fontScale } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [width, setWidth] = useState(280);
  const columns = width / Math.max(1, fontScale) < 280 ? 1 : 2;
  const cellWidth = columns === 1 ? width : Math.floor((width - 12) / 2) - 1;
  const needle = query.trim().toLocaleLowerCase(locale);
  const arcana = Array.from({ length: 22 }, (_, i) => ({
    n: i + 1, label: arcanumTitle(locale, i + 1), href: `/encyclopedia/arcanum/${i + 1}`,
  }));
  const topics = links.map((link, index) => {
    const entry = (Object.entries(D.encSections) as [Kind, typeof D.encSections[Kind]][])
      .find(([, item]) => item.title[locale] === link.label);
    return { ...link, n: topicCards[entry?.[0] ?? 'art'] ?? 5, index };
  });
  const found = [
    ...arcana.filter(card => `${card.n} ${card.label}`.toLocaleLowerCase(locale).includes(needle)),
    ...topics.filter(topic => topic.label.toLocaleLowerCase(locale).includes(needle)),
  ];
  const go = (href: string) => {
    // /year is the website's reference hub and the app's calculator.
    void navigate(href === '/year' ? '/encyclopedia/year' : href)
      .catch(error => Alert.alert(String(error.message)));
  };
  return <View testID="design-library" style={{ gap: 22 }}>
    <TabHeading title={t('Знания', 'Library')} />
    <View style={s.searchBox}>
      <Icon name="book" size={20} color={design.accent} />
      <TextInput testID="library-search" value={query} onChangeText={setQuery}
        accessibilityLabel={t('Поиск по энциклопедии', 'Search the encyclopedia')}
        placeholder={t('Аркан, число или тема', 'Arcanum, number or topic')}
        placeholderTextColor={design.muted} autoCorrect={false} returnKeyType="search" style={s.search} />
      {!!query && <Pressable accessibilityRole="button" accessibilityLabel={t('Очистить поиск', 'Clear search')}
        onPress={() => setQuery('')} style={s.clear}><Text style={s.clearText}>×</Text></Pressable>}
    </View>
    {needle ? <View testID="library-search-results" style={{ gap: 12 }}>
      <Heading>{t('Найдено', 'Results')} · {found.length}</Heading>
      {found.map((item, index) => <Pressable key={`${item.href}-${index}`} accessibilityRole="link"
        accessibilityLabel={item.label} onPress={() => go(item.href)} style={s.result}>
        <ArcanumImage n={item.n} width={40} decorative />
        <Text style={[s.resultTitle, { flex: 1 }]}>{item.label}</Text>
        <Icon name="arrow" color={design.accent} size={17} />
      </Pressable>)}
      {!found.length && <Body muted>{t('Ничего не найдено', 'No results found')}</Body>}
    </View> : <>
      <View style={{ gap: 12 }}>
        <Heading>{t('Арканы', 'Arcana')}</Heading>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
          {arcana.map(card => <Pressable key={card.n} testID={`library-arcanum-${card.n}`}
            accessibilityRole="link" accessibilityLabel={`${card.n} · ${card.label}`}
            onPress={() => go(card.href)} style={{ width: 88 * Math.max(1, fontScale), gap: 8 }}>
            <ArcanumImage n={card.n} width={88} decorative />
            <Text style={s.cardTitle}>{card.n} · {card.label}</Text>
          </Pressable>)}
        </ScrollView>
      </View>
      <View style={{ gap: 12 }}>
        <Heading>{t('Разделы', 'Topics')}</Heading>
        <View testID="library-topics" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={s.grid}>
          {topics.map(topic => <Pressable key={`${topic.href}-${topic.index}`}
            testID={`library-topic-${topic.index}`} accessibilityRole="link" accessibilityLabel={topic.label}
            onPress={() => go(topic.href)} style={({ pressed }) => [s.tile, { width: cellWidth, opacity: pressed ? 0.65 : 1 }]}>
            <View style={{ alignSelf: 'center', transform: [{ rotate: '-6deg' }] }}>
              <ArcanumImage n={topic.n} width={58} decorative />
            </View>
            <Text style={s.topicTitle}>{topic.label}</Text>
            <View style={{ alignSelf: 'flex-end' }}><Icon name="arrow" color={design.gold} size={15} /></View>
          </Pressable>)}
        </View>
      </View>
    </>}
  </View>;
}

const s = StyleSheet.create({
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    backgroundColor: '#fffaf0', borderColor: '#d9c9ac', borderWidth: 1, borderRadius: 5 },
  search: { flex: 1, minWidth: 0, minHeight: 52, fontFamily: fonts.body, fontSize: 14, color: '#252c35' },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontFamily: fonts.body, fontSize: 24, color: '#087b75' },
  cardTitle: { fontFamily: fonts.body, fontSize: 11, lineHeight: 17, color: '#686359' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { padding: 16, gap: 12, backgroundColor: '#fffaf0', borderColor: '#d9c9ac', borderWidth: 1,
    borderRadius: 5, justifyContent: 'space-between' },
  topicTitle: { fontFamily: fonts.display, fontSize: 23, lineHeight: 28, color: '#243632' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    backgroundColor: '#fffaf0', borderColor: '#d9c9ac', borderWidth: 1, borderRadius: 5 },
  resultTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: '#243632' },
});
