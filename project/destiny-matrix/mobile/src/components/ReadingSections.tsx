import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextProps } from 'react-native';
import { D } from '@/lib/i18n';
import type { SectionOut } from '@/lib/publicSpec';
import type { Paragraph } from '@/lib/contentReader';
import type { ChakraReadingRow, LongformReading, ReadingConclusion, ReadingRole, ReadingRoleParts } from '@/lib/readingTypes';
import { useApp } from '../state/AppState';
import { useDesign, usePalette } from '../state/Design';
import { Body, Card, Heading, RichText, colors, fonts } from './ui';
import { AppLink } from './AppLink';
import { ArcanumImage } from './ArcanumImage';
import { ArcanumCards } from './ArcanumCards';

function ReadingLabel({ style, ...props }: TextProps) {
  const palette = usePalette();
  return <Text {...props} style={[style, { color: palette.accent }]} />;
}

function useReadingPresentation() {
  const { design } = useDesign();
  return { design, panel: {
    backgroundColor: 'transparent', borderColor: design.border, borderRadius: 0,
    borderWidth: 0, borderTopWidth: 1,
    padding: 0, paddingTop: 18,
    gap: 14,
  }, gap: 22 };
}

function Conclusion({ value }: { value: ReadingConclusion }) {
  const { t } = useApp();
  const { panel, design } = useReadingPresentation();
  return <View style={s.conclusion}>{([['summary', t('Итог', 'Summary')], ['strength', t('Сильная сторона', 'Strength')], ['tension', t('Трудность', 'Tension')], ['practice', t('Практика', 'Practice')]] as const)
    .map(([key, title]) => value[key] ? <View key={key} style={[s.panel, panel, key === 'summary' && { borderLeftWidth: 3, borderLeftColor: design.gold, paddingLeft: 14 }]}><Heading>{title}</Heading><RichText text={value[key]} /></View> : null)}</View>;
}
function RoleParts({ role }: { role: ReadingRoleParts }) {
  const { locale } = useApp();
  return <View style={s.parts}>{(['essence', 'strength', 'risk', 'action'] as const).map(key => role[key] ?
    <View key={key} style={{ gap: 4 }}><ReadingLabel style={s.partLabel}>{D.sheet[key][locale]}</ReadingLabel><RichText text={role[key]} /></View> : null)}</View>;
}
function Role({ role }: { role: ReadingRole }) {
  const { t } = useApp();
  const { panel } = useReadingPresentation();
  const cardWidth = 132;
  return <View style={[s.panel, panel]}><Text style={[s.eyebrow, { textAlign: 'left' }]}>{role.label}</Text>
    <ArcanumCards cards={[{ arcanum: role.arcanum, label: role.title, href: `/encyclopedia/arcanum/${role.arcanum}` }]} maxWidth={cardWidth} />
    {role.sameAs ? <Body>{t('См. ', 'See ')}{role.sameAs.label}</Body> : <><View style={s.question}><Body>{role.question}</Body></View><RoleParts role={role} /></>}
  </View>;
}
export function Chakra({ row, showCards = true }: { row: ChakraReadingRow; showCards?: boolean }) {
  return <View style={s.chakra}><View style={s.chakraHeading}><Heading>{row.title}</Heading><Body muted>{row.topic}</Body>
    <ReadingLabel style={s.numbers}>{row.cells.map(c => c.arcanum).join(' / ')}</ReadingLabel></View>
    {showCards && <ArcanumCards columns={3} cards={row.cells.map(c => ({ arcanum: c.arcanum, label: c.title, href: `/encyclopedia/arcanum/${c.arcanum}` }))} />}
    {!showCards && <Body muted>{row.cells.map(c => `${c.title}: ${c.arcanum}`).join(' · ')}</Body>}
    {row.cells.filter(c => c.caption).map(c => <View key={c.column} style={s.cellCaption}><ReadingLabel style={s.partLabel}>{c.title} · {c.arcanum}</ReadingLabel><RichText text={c.caption} /></View>)}
    <Heading>{row.heading}</Heading>{row.paragraphs.map((p, i) => <RichText key={i} text={p} />)}</View>;
}
export function CorpusParagraph({ paragraph }: { paragraph: Paragraph }) {
  if (typeof paragraph === 'string') return <RichText text={paragraph} />;
  if ('h3' in paragraph) return <Heading>{paragraph.h3}</Heading>;
  if ('ul' in paragraph || 'ol' in paragraph) return <View style={{ gap: 8 }}>{('ul' in paragraph ? paragraph.ul : paragraph.ol).map((item, i) => <RichText key={i} text={`${'ol' in paragraph ? `${i + 1}.` : '•'} ${item}`} />)}</View>;
  if ('table' in paragraph) return <View style={{ gap: 10 }}>{paragraph.table.rows.map((row, i) => <View key={i}>{row.map((cell, j) => <RichText key={j} text={`${paragraph.table.head[j]}: ${cell}`} />)}</View>)}</View>;
  if ('chakra_reading' in paragraph) return <Chakra row={paragraph.chakra_reading.row} />;
  return <AppLink href={paragraph.slot === 'pair' ? '/compatibility' : '/calculate'} label={paragraph.slot === 'pair' ? '↗' : '→'} />;
}
export function Longform({ value, hideLead = false }: { value: LongformReading; hideLead?: boolean }) {
  const { panel, gap } = useReadingPresentation();
  return <View style={[s.longform, { gap }]}>{!hideLead && !!value.lead && <Body>{value.lead}</Body>}{value.caption && <Text style={s.eyebrow}>{value.caption}</Text>}
    {value.rolesTitle && <Heading>{value.rolesTitle}</Heading>}{value.rolesLead && <RichText text={value.rolesLead} />}
    {value.roles?.map(role => <Role key={role.key} role={role} />)}
    {value.chakraRows?.map(row => <Chakra key={row.key} row={row} />)}
    {value.energyField && <Chakra row={value.energyField} />}{value.chakraNote && <RichText text={value.chakraNote} />}
    {value.agePeriods?.map((p, i) => <View key={i} style={[s.panel, panel, p.current && s.summary]}><Text style={s.eyebrow}>{p.from}–{p.to}</Text>
      <ArcanumCards cards={[{ arcanum: p.arcanum, label: p.title, href: `/encyclopedia/arcanum/${p.arcanum}` }]} maxWidth={132} />
      <RoleParts role={p} /></View>)}
    {value.interactionsTitle && <Heading>{value.interactionsTitle}</Heading>}{value.interactionsLead && <RichText text={value.interactionsLead} />}
    {value.interactions?.map(part => <View key={part.key} style={[s.panel, panel]}><Heading>{part.title}</Heading>{part.caption && <Body muted>{part.caption}</Body>}
      {part.paragraphs.map((p, i) => <RichText key={i} text={p} />)}{part.href && <AppLink href={part.href} label={part.linkLabel ?? part.title} />}</View>)}
    <Conclusion value={value} />
  </View>;
}
export function ReadingSectionBody({ section }: { section: SectionOut }) {
  const { t } = useApp();
  if (section.locked) return null;
  const positions = section.positions.filter(position => !position.role);
  return <View style={{ gap: 20 }}>
      {!!section.lead && <RichText text={section.lead} />}
      {section.longform ? <Longform value={section.longform} hideLead={section.lead === section.longform.lead} /> : <>
        {positions.length > 0 && <ArcanumCards cards={positions.map(p => ({ arcanum: p.arcanum, label: p.label, href: p.href }))} />}
        {section.positions.map((p, i) => <View key={i} style={{ gap: 10 }}>
          {p.role ? <Role role={p.role} /> : p.text ? <View style={s.positionText}><ReadingLabel style={s.partLabel}>{p.label} · {p.arcanum}</ReadingLabel><RichText text={p.text} /></View> : null}
          {p.article && <AppLink href={p.article.href} label={p.article.label} />}
        </View>)}
        {section.conclusion && <Conclusion value={section.conclusion} />}
        {section.tripleReading && <Chakra row={section.tripleReading} showCards={positions.length === 0} />}
        {section.tailReading?.paragraphs.map((p, i) => <CorpusParagraph key={i} paragraph={p} />)}
      </>}
      <View style={s.more}><AppLink href={section.personalHref ?? `/encyclopedia/position/${section.key}`} label={t('Подробнее в энциклопедии', 'Read more in the encyclopedia')} /></View>
  </View>;
}

export function ReadingSection({ section, number, open: controlledOpen, onOpenChange, footer }: {
  section: SectionOut; number?: number; open?: boolean; onOpenChange?: (open: boolean) => void; footer?: ReactNode;
}) {
  const { t } = useApp();
  const { design } = useDesign();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const chapter = `${t('Глава', 'Chapter')}${number ? ` ${String(number).padStart(2, '0')}` : ''}`;
  const mark = <ReadingLabel style={s.toggleMark} accessible={false}>{open ? '−' : '+'}</ReadingLabel>;
  const heading = <View style={{ gap: 3 }}><Heading>{section.title}</Heading>{section.locked && <Text style={s.lockLabel}>{t('закрыто', 'locked')}</Text>}</View>;
  const cards = section.positions.slice(0, 3);
  return <Card style={{ gap: open ? 18 : 10, padding: 18 }}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} testID={`section-${section.key}`} onPress={() => {
    if (controlledOpen === undefined) setLocalOpen(!open);
    onOpenChange?.(!open);
  }} style={{ minHeight: 48, gap: 10 }}>
    <>
      <View style={[s.chapterRail, { borderBottomWidth: 1, borderColor: design.border, paddingBottom: 8 }]}>
        <ReadingLabel style={s.chapterLabel}>{chapter}</ReadingLabel>
        {cards[0] && <ArcanumImage n={cards[0].arcanum} width={26} decorative />}{mark}
      </View>
      {heading}
    </>
  </Pressable>{open && <>
    {section.locked ? <><ArcanumCards cards={section.positions.map(p => ({ arcanum: p.arcanum, label: p.label, href: p.href }))} maxWidth={104} />
      <View style={s.locked}><Body muted>{t('Полный разбор доступен владельцу покупки или подписки. Ранее купленные разборы находятся в кабинете.', 'The full reading is available with a purchase or subscription. Find your existing readings in your account.')}</Body></View></> : <>
      <ReadingSectionBody section={section} />
    </>}{footer}
  </>}</Card>;
}

const s = StyleSheet.create({
  longform: { gap: 20 },
  panel: { gap: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, borderRadius: 12, padding: 16 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 17, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted, textAlign: 'center' },
  question: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  parts: { gap: 12 },
  partLabel: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18 },
  conclusion: { gap: 12, paddingTop: 8 },
  summary: { borderLeftWidth: 3, borderLeftColor: colors.gold, backgroundColor: colors.card2 },
  chakra: { gap: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 18 },
  chakraHeading: { gap: 5 },
  numbers: { fontFamily: fonts.display, fontSize: 25, lineHeight: 29 },
  cellCaption: { gap: 6, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border },
  sectionToggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  chapterRail: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chapterLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 10, lineHeight: 17, letterSpacing: 1.1, textTransform: 'uppercase' },
  chapterNumber: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 23 },
  toggleMark: { fontFamily: fonts.display, fontSize: 27, lineHeight: 32, width: 20, textAlign: 'center' },
  lockLabel: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.muted },
  locked: { padding: 14, backgroundColor: colors.card2, borderRadius: 10 },
  positionText: { gap: 6 },
  more: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 8 },
});
