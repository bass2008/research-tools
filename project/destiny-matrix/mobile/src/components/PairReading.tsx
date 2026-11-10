import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View, Text } from 'react-native';
import { DP } from '@/lib/i18n/dict/pair';
import { forLocale as matrixForLocale } from '@/lib/matrix';
import { computePair, pointsOf } from '@/lib/pair/engine';
import { businessMatrix, businessPoints, BUSINESS_SPHERES, BUSINESS_FREE, businessUnitKey, businessUnitKeys } from '@/lib/pair/business';
import { characters, visible, unitKeys, FREE, type PairUnit } from '@/lib/pair/spheres';
import { pairChakraMap, pairChakraReading, pairChakraKeys } from '@/lib/pair/chakraReading';
import { useApp } from '../state/AppState';
import { useBilling } from '../state/Billing';
import { useRemote } from '../state/useRemote';
import { useProductAccess } from '../state/useProductAccess';
import { isReading } from '../native/contracts';
import { record } from '../native/http';
import { authHref } from '../native/authReturn';
import { AppLink } from './AppLink';
import { MatrixMap } from './MatrixMap';
import { ChartCover } from './ChartCover';
import { CorpusParagraph, Longform } from './ReadingSections';
import { ReadingActions } from './ReadingActions';
import { Action, Body, Card, Field, Heading, RemoteStatus, RichText, colors, styles } from './ui';
import { Icon } from './BrandArt';
import { ArcanumImage } from './ArcanumImage';
import { ReaderAnchor, ReaderContentsButton, ReaderSectionEnd, useReaderSections } from './ReaderNavigation';

const isUnits = (v: unknown): v is { units: Record<string, PairUnit | null> } => record(v) && record(v.units) && Object.values(v.units).every(x => x === null || record(x) && typeof x.unit === 'string' &&
  (x.text === undefined || x.text === null || typeof x.text === 'string' || Array.isArray(x.text) && x.text.every(t => typeof t === 'string')));
function Unit({ unit }: { unit: PairUnit | null | undefined }) {
  if (!unit) return null;
  return <View style={{ gap: 10 }}>{unit.title && <Heading>{unit.title}</Heading>}
    {unit.meaning && <RichText text={unit.meaning} />}
    {(typeof unit.text === 'string' ? [unit.text] : unit.text ?? []).map((p, i) => <RichText key={i} text={p} />)}
    {unit.captions && Object.entries(unit.captions).map(([key, text]) => <Body key={key} muted>{text}</Body>)}
    {unit.report?.map((p, i) => <CorpusParagraph key={i} paragraph={p} />)}
    {unit.article && <AppLink href={unit.article} label={unit.title ?? unit.article} />}
  </View>;
}
function SphereCard({ title, lead, numbers, locked, children, sectionKey, open: controlledOpen, onOpenChange, footer }: {
  title: string; lead: string; numbers: string; locked: boolean; children: React.ReactNode;
  sectionKey: string; open?: boolean; onOpenChange?: (open: boolean) => void; footer?: React.ReactNode;
}) {
  const { t } = useApp(); const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const arcana = (numbers.match(/\d+/g) ?? []).map(Number).filter(n => n > 0 && n <= 22).slice(0, 3);
  return <Card><Pressable testID={`section-${sectionKey}`} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => {
    if (controlledOpen === undefined) setLocalOpen(!open);
    onOpenChange?.(!open);
  }} style={{ minHeight: 44, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
    <View style={{ flex: 1, gap: 5 }}><Heading>{title}</Heading>{!!numbers && <Body muted>{numbers}</Body>}{locked && <Text style={[styles.eyebrow, { color: colors.gold, fontSize: 9 }]}>{t('Полный разбор', 'Full reading')}</Text>}</View>
    <Icon name={locked ? 'lock' : 'arrow'} size={18} color={colors.gold} />
  </Pressable>{open && <>{arcana.length > 0 && <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginVertical: 8 }}>{arcana.map((n, i) => <ArcanumImage key={i} n={n} width={70} decorative />)}</View>}{!!lead && <Body>{lead}</Body>}{locked ? <Body muted>{t('Полный текст доступен с покупкой или подпиской.', 'The full text is available with a purchase or subscription.')}</Body> : children}{footer}</>}</Card>;
}
export function PairReading({ dates, id, unlocked: savedUnlocked = false, until: savedUntil = null }: { dates: { a: string; b: string }; id?: number; unlocked?: boolean; until?: string | null }) {
  const { locale, api, session, t } = useApp();
  const billing = useBilling();
  const rights = useProductAccess('pair');
  const unlocked = savedUnlocked || rights.unlimited;
  const until = savedUnlocked ? savedUntil : rights.until;
  const [title, setTitle] = useState('');
  const result = useMemo(() => computePair(dates.a, dates.b, locale), [dates.a, dates.b, locale]);
  const spheres = visible(result.a, result.b);
  const business = useMemo(() => businessMatrix(dates.a, dates.b, locale), [dates.a, dates.b, locale]);
  const bp = businessPoints(business);
  const query = new URLSearchParams(Object.fromEntries(['A', 'B', 'E', 'M', 'N', 'D', 'spiritual'].map(k => [k, String(result.p[k as keyof typeof result.p])])));
  query.set('base', String(bp.base)); query.set('plus', String(bp.plus));
  const allKeys = [...spheres.flatMap(s => unitKeys(s, result.a, result.b, result.p)), ...businessUnitKeys(bp), ...pairChakraKeys(locale, dates)];
  const units = useRemote(id && unlocked ? `/pair/reading-units?id=${id}` : rights.unlimited ? `/pair/units?keys=${encodeURIComponent(allKeys.join(','))}` : `/pair/preview?${query}`, isUnits, {
    private: unlocked, grant: () => unlocked && session ? { userId: session.user.id, until, readingId: id } : undefined,
  });
  const chakraReading = useMemo(() => {
    if (!unlocked || !units.data) return null;
    try { return pairChakraReading(locale, dates, units.data.units); } catch { return null; }
  }, [unlocked, units.data, locale, dates]);
  const positions = (numbers: number[]) => numbers.map(arcanum => ({ arcanum }));
  const chakraTotals = pairChakraMap(locale, dates).totals;
  const reader = useReaderSections([
    ...spheres.map(s => ({ key: `pair-${s.id}`, title: DP.sphere[s.id].title[locale], locked: !unlocked && !FREE.includes(s.id),
      positions: positions(s.id === 'characters' ? characters(result.a, result.b).map(item => item.card)
        : (s.cards ?? []).map(([key]) => result.p[key])),
    })),
    { key: 'pair-merge', title: DP.mergeTitle[locale], positions: positions([result.a.E, result.b.E]) },
    { key: 'pair-chakras', title: DP.chakras.title[locale], locked: !unlocked,
      positions: positions([chakraTotals.physics, chakraTotals.energy, chakraTotals.emotions]) },
    { key: 'business-map', title: DP.business.title[locale], positions: positions([pointsOf(business).E]) },
    ...BUSINESS_SPHERES.map(s => ({ key: `business-${s.id}`, title: DP.business.sphere[s.id].title[locale], locked: !unlocked && !(BUSINESS_FREE as readonly string[]).includes(s.id),
      positions: positions(s.points.map(point => bp[point])),
    })),
  ], JSON.stringify([session?.user.id ?? null, id, dates.a, dates.b, unlocked]), !rights.loading && !units.loading);
  const navigation = (key: string) => ({ sectionKey: key, open: reader ? reader.openKey === key : undefined,
    onOpenChange: (open: boolean) => reader?.toggle(key, open), footer: <ReaderSectionEnd sectionKey={key} /> });
  return <>
    <ChartCover title={DP.mapTitle[locale]} dates={[matrixForLocale(locale).birthLabel(dates.a), matrixForLocale(locale).birthLabel(dates.b)]}
      points={result.p} variant="pair" />
    <RemoteStatus {...units} />
    {id ? <ReadingActions id={id} unlocked={unlocked} until={until} /> : session ? <Card>
      <Field label={t('Подпись пары (необязательно)', 'Couple label (optional)')} value={title} onChangeText={setTitle} maxLength={200} />
      <Action testID="save-pair" title={DP.saveToAccount[locale]} onPress={async () => {
        const row = await api('/readings', isReading, { method: 'POST', body: { product: 'pair', inputs: { a: { birth: dates.a }, b: { birth: dates.b } }, title } });
        router.push(`/reading/${row.id}`);
      }} /></Card> : <AppLink testID="save-pair-auth" href={authHref('login', `/compatibility?${new URLSearchParams(dates)}`)} label={t('Войти и сохранить пару', 'Sign in to save this couple')} />}
    <Heading>{DP.readingTitle[locale]}</Heading>
    <ReaderContentsButton />
    {billing.canPurchase && !unlocked && <AppLink href={`/purchase?product=pair&${id ? `id=${id}` : `a=${dates.a}&b=${dates.b}`}`} label={DP.openFull[locale]} />}
    {spheres.map(s => <ReaderAnchor key={s.id} sectionKey={`pair-${s.id}`}><SphereCard {...navigation(`pair-${s.id}`)} title={DP.sphere[s.id].title[locale]} lead={DP.sphere[s.id].lead[locale]}
      numbers={s.nums?.(result.p) ?? ''} locked={!unlocked && !FREE.includes(s.id)}>
      {unitKeys(s, result.a, result.b, result.p).map(key => <Unit key={key} unit={units.data?.units[key]} />)}
    </SphereCard></ReaderAnchor>)}
    <ReaderAnchor sectionKey="pair-merge"><SphereCard {...navigation('pair-merge')} title={DP.mergeTitle[locale]} lead={DP.mergeLead[locale]} numbers="" locked={false}>
      <Heading>{DP.partnerA[locale]}</Heading><MatrixMap points={result.a} variant="pair" /><Heading>{DP.partnerB[locale]}</Heading><MatrixMap points={result.b} variant="pair" />
    </SphereCard></ReaderAnchor>
    <ReaderAnchor sectionKey="pair-chakras"><SphereCard {...navigation('pair-chakras')} title={DP.chakras.title[locale]} lead="" numbers="" locked={!unlocked}>
      {chakraReading ? <Longform value={chakraReading} /> : <Body muted>{t('Разбор чакр пары входит в полный разбор.', 'The chakra reading is included in the full couple reading.')}</Body>}
    </SphereCard></ReaderAnchor>
    <ReaderAnchor sectionKey="business-map"><SphereCard {...navigation('business-map')} title={DP.business.title[locale]} lead={DP.business.lead[locale]} numbers="" locked={false}>
      <MatrixMap points={pointsOf(business)} />
    </SphereCard></ReaderAnchor>
    {BUSINESS_SPHERES.map(s => <ReaderAnchor key={s.id} sectionKey={`business-${s.id}`}><SphereCard {...navigation(`business-${s.id}`)} title={DP.business.sphere[s.id].title[locale]} lead={DP.business.sphere[s.id].lead[locale]}
      numbers={s.points.map(p => bp[p]).join(' · ')} locked={!unlocked && !(BUSINESS_FREE as readonly string[]).includes(s.id)}>
      {s.points.map(p => <Unit key={p} unit={units.data?.units[businessUnitKey(p, bp[p])]} />)}
    </SphereCard></ReaderAnchor>)}
  </>;
}
