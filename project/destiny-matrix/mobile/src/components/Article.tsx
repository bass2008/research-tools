import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { isMobileArticle, type ContentBlock, type MobileArticle } from '@/lib/mobileContentContract';
import { matrixPages } from '@/lib/i18n/dict/matrixPages';
import { forLocale as navigationForLocale } from '@/lib/encyclopediaNavigation';
import { useRemote } from '../state/useRemote';
import { useApp } from '../state/AppState';
import { arcanumTitle } from '../daily/arcanumTitles';
import { DesignSurface, useDesign, usePalette } from '../state/Design';
import { useNavigate } from './AppLink';
import { MatrixMap } from './MatrixMap';
import { ArcanumImage } from './ArcanumImage';
import { ArcanumCards } from './ArcanumCards';
import { LibraryTopics } from './LibraryTopics';
import { Action, Body, Page, Paper, RemoteStatus, RichText, colors, fonts, styles } from './ui';

// This reader uses the shared public cache. Private reports have their own
// account-scoped reader and must never be admitted by this cache's guard.
const isPublicArticle = (value: unknown): value is MobileArticle => isMobileArticle(value) && value.access === 'public';

type ArticleLink = Extract<ContentBlock, { type: 'link' }>;
function linkArcana(href: string): number[] {
  const match = /^(?:\/encyclopedia\/(?:arcanum|compatibility)|\/year)\/(\d{1,2})(?:\?|$)/.exec(href)
    ?? /^\/encyclopedia\/(?:combination|karmic-tail|compatibility\/tails)\/(\d{1,2}(?:-\d{1,2}){1,2})(?:\?|$)/.exec(href);
  const numbers = match?.[1].split('-').map(Number) ?? [];
  return numbers.every(n => n >= 1 && n <= 22) ? numbers : [];
}
function Links({ links }: { links: ArticleLink[] }) {
  const navigate = useNavigate();
  const { design } = useDesign();
  if (links.length >= 4 && links.every(link => linkArcana(link.href).length === 1)) {
    return <Paper style={{ padding: 8 }}><ArcanumCards columns={2} cards={links.map(link => ({ arcanum: linkArcana(link.href)[0], label: link.label, href: link.href }))} /></Paper>;
  }
  return <DesignSurface kind="paper"><View style={s.links}>{links.map((link, index) => {
    const numbers = link.href === '/encyclopedia/arcanum' ? [1, 2, 3] : linkArcana(link.href);
    // The shared article still points its calculator CTA at the website home.
    // Other links to "/" retain that destination.
    const href = link.href === '/' && Object.values(matrixPages.calcMatrix).includes(link.label) ? '/calculate' : link.href;
    return <Pressable key={`${link.href}-${index}`} accessibilityRole="link" accessibilityLabel={link.label}
      onPress={() => { void navigate(href).catch(error => Alert.alert(String(error.message))); }} style={[s.linkRow, { backgroundColor: design.paper, borderColor: design.border, borderRadius: design.radius }]}>
      {numbers.length > 0 && <View style={s.miniatures}>{numbers.map((n, i) => <ArcanumImage key={i} n={n} width={numbers.length === 1 ? 44 : 32} decorative />)}</View>}
      {numbers.length === 0 && links.length >= 4 && <Text style={s.linkNumber} accessible={false}>{String(index + 1).padStart(2, '0')}</Text>}
      <Text style={s.linkLabel}>{link.label}</Text><Text style={s.arrow} accessible={false}>›</Text>
    </Pressable>;
  })}</View></DesignSurface>;
}
function Catalog({ links }: { links: ArticleLink[] }) {
  const { t } = useApp();
  const { design } = useDesign();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(24);
  const needle = query.trim().toLocaleLowerCase();
  const filtered = links.filter(link => `${link.label} ${link.href}`.toLocaleLowerCase().includes(needle));
  return <View style={s.catalog}>
    {links.length > 12 && <View style={[s.searchBox, { backgroundColor: design.paper, borderColor: design.border, borderRadius: design.radius }]}><TextInput testID="encyclopedia-search" value={query}
      onChangeText={value => { setQuery(value); setLimit(24); }} autoCorrect={false} returnKeyType="search"
      accessibilityLabel={t('Поиск по энциклопедии', 'Search the encyclopedia')}
      placeholder={t('Аркан, число или тема', 'Arcanum, number or topic')} placeholderTextColor={colors.muted}
      style={s.search} /><Text style={s.count}>{filtered.length}</Text></View>}
    {filtered.length ? <Links links={filtered.slice(0, limit)} /> : <Body muted>{t('Ничего не найдено', 'No results found')}</Body>}
    {filtered.length > limit && <Action secondary title={t('Показать ещё', 'Show more')} onPress={() => setLimit(value => value + 24)} />}
  </View>;
}

function Block({ block, waite }: { block: ContentBlock; waite?: number }) {
  const palette = usePalette(); const { design } = useDesign();
  switch (block.type) {
    case 'paragraph': return <RichText text={block.text} />;
    case 'heading': return <View style={block.level === 2 ? s.sectionHead : s.subsectionHead}>
      <Text accessibilityRole="header" style={[s.heading, block.level === 3 && s.subheading, { color: palette.ink }]}>{block.text}</Text>
      {waite !== undefined && <View style={s.waite}><ArcanumImage n={waite} width={156} waite /></View>}
    </View>;
    case 'link': return <Links links={[block]} />;
    case 'list': return <View style={s.list}>{block.items.map((item, i) => <RichText key={i} text={`${block.ordered ? `${i + 1}.` : '•'} ${item}`} />)}</View>;
    case 'matrix': return <Paper style={{ padding: 12 }}><MatrixMap points={block.points} highlight={block.highlight} /></Paper>;
    case 'cards': return <Paper style={{ padding: 10 }}><ArcanumCards cards={block.cards} /></Paper>;
    case 'table': return <DesignSurface kind="paper"><ScrollView horizontal style={[s.table, { borderColor: design.border }]}><View>
      {[block.head, ...block.rows].map((row, i) => <View key={i} style={[s.tableRow, { backgroundColor: i ? design.paper : colors.card2 }]}>{row.map((cell, j) =>
        <View key={j} style={s.tableCell}>{i === 0 ? <Text style={[styles.text, { fontFamily: fonts.bold }]}>{cell}</Text> : <RichText text={cell} />}</View>)}</View>)}
    </View></ScrollView></DesignSurface>;
  }
}
function Blocks({ blocks, arcanum }: { blocks: ContentBlock[]; arcanum?: number }) {
  const waiteAt = blocks.findIndex(block => block.type === 'heading' && /Уэйт|Waite/i.test(block.text));
  const result = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'link') {
      const start = i, links: ArticleLink[] = [block];
      while (blocks[i + 1]?.type === 'link') links.push(blocks[++i] as ArticleLink);
      result.push(<Links key={start} links={links} />);
    } else result.push(<Block key={i} block={block} waite={i === waiteAt ? arcanum : undefined} />);
  }
  return <View style={s.prose}>{result}</View>;
}
export function Article({ path, tab = false }: { path: string; tab?: boolean }) {
  const { locale, t } = useApp();
  const { design } = useDesign();
  const { width, fontScale } = useWindowDimensions();
  const remote = useRemote(`/content?path=${encodeURIComponent(path)}`, isPublicArticle);
  const article = remote.data?.access === 'public' ? remote.data : undefined;
  const first = article?.blocks[0];
  const heroCards = first?.type === 'cards' ? first.cards : undefined;
  const arcanum = /^\/encyclopedia\/arcanum\/(\d{1,2})(?:\?|$)/.exec(path)?.[1];
  const arcanumHero = arcanum && heroCards?.length === 1 ? heroCards[0] : undefined;
  const stackedHero = !!arcanumHero && width / Math.max(1, fontScale) < 375;
  const articlePath = (article?.path ?? path).split('?')[0];
  const isLibrary = articlePath === '/encyclopedia';
  const isCatalog = /^\/encyclopedia(?:\/(?:arcanum|position|chakra|combination|karmic-tail|compatibility(?:\/tails)?))?$/.test(articlePath) || articlePath === '/year';
  const catalog = isCatalog ? article?.blocks.filter((block): block is ArticleLink => block.type === 'link'
    && (articlePath === '/encyclopedia' || block.href.startsWith(articlePath + '/'))) ?? [] : [];
  const body = (heroCards ? article?.blocks.slice(1) : article?.blocks)?.filter(block => !catalog.includes(block as ArticleLink)) ?? [];
  return <Page tab={tab} scene={isLibrary ? 'library' : undefined} title={article || isLibrary ? undefined : t('Энциклопедия', 'Encyclopedia')}>
    {isLibrary && <LibraryTopics
      links={article ? catalog : navigationForLocale(locale).ENCYCLOPEDIA_SECTIONS.flatMap(item => 'hub' in item ? [{ href: item.hub, label: item.title }] : [])} />}
    <RemoteStatus {...remote} />
    {article && !isLibrary && <>
      {!isLibrary && <View testID="article-hero" style={[s.hero, stackedHero && s.heroStacked]}>
        {arcanumHero && (stackedHero ? <View testID="article-card-intro" style={s.cardIntro}>
          <ArcanumImage n={arcanumHero.arcanum} width={88} />
          <Text style={[s.eyebrow, { flex: 1, color: design.accent }]}>{arcanumHero.arcanum} · {arcanumHero.label}</Text>
        </View> : <ArcanumImage n={arcanumHero.arcanum} width={112} />)}
        <View testID="article-heading" style={[s.heroText, stackedHero && s.heroTextFull]}>{arcanumHero && !stackedHero && <Text style={[s.eyebrow, { color: design.accent }]}>{arcanumHero.arcanum} · {arcanumHero.label}</Text>}
          <Text accessibilityRole="header" style={[styles.title, s.title, { color: design.ink }]}>{arcanumHero ? arcanumTitle(locale, arcanumHero.arcanum) : article.title}</Text>
        </View>
      </View>}
      {!arcanumHero && heroCards && <Paper style={{ padding: 10 }}><ArcanumCards cards={heroCards} /></Paper>}
      {!isCatalog && !!article.lead && <RichText text={article.lead} />}
      {catalog.length > 0 && !isLibrary && <Catalog key={articlePath} links={catalog} />}
      {isCatalog && !!article.lead && <View testID="catalog-reference" style={s.reference}>
        <Text accessibilityRole="header" style={[s.heading, { color: design.ink }]}>{t('О разделе', 'About this section')}</Text>
        <RichText text={article.lead} />
      </View>}
      <Blocks blocks={body} arcanum={arcanum ? Number(arcanum) : undefined} />
    </>}
  </Page>;
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  heroStacked: { flexDirection: 'column', alignItems: 'stretch' },
  cardIntro: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  heroText: { flex: 1, minWidth: 0, gap: 8 },
  heroTextFull: { flex: 0, width: '100%' },
  title: { fontSize: 29, lineHeight: 37 },
  eyebrow: { fontFamily: fonts.bold, color: colors.teal, fontSize: 11, lineHeight: 16, letterSpacing: 0.7 },
  reference: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 22, gap: 12 },
  prose: { gap: 18 },
  sectionHead: { paddingTop: 16, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 16 },
  subsectionHead: { paddingTop: 6, gap: 12 },
  heading: { fontFamily: fonts.display, fontSize: 27, lineHeight: 34, paddingBottom: 2, color: colors.ink },
  subheading: { fontSize: 23, lineHeight: 29 },
  list: { gap: 10, paddingLeft: 6 },
  waite: { alignItems: 'center', paddingVertical: 8 },
  links: { gap: 9 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, padding: 12, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  miniatures: { flexDirection: 'row', gap: 3 },
  linkLabel: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink },
  arrow: { color: colors.gold, fontFamily: fonts.display, fontSize: 26 },
  linkNumber: { width: 28, color: colors.gold, fontFamily: fonts.display, fontSize: 24 },
  catalog: { gap: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14 },
  search: { flex: 1, minWidth: 0, minHeight: 48, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink },
  count: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tableCell: { padding: 12, width: 170 },
});
