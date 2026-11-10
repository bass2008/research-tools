import { useCallback, useState } from 'react';
import { BackHandler, Keyboard } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { computePair } from '@/lib/pair/engine';
import { DP } from '@/lib/i18n/dict/pair';
import { useMe } from '../../state/Me';
import { useApp } from '../../state/AppState';
import { DateFields, isoDate } from '../../components/DateFields';
import { Action, Card, Heading, Page } from '../../components/ui';
import { PairReading } from '../../components/PairReading';
import { TabHeading } from '../../components/TabHeading';
import { ResultHeading } from '../../components/ResultHeading';
import { ReaderPage } from '../../components/ReaderNavigation';

function linkedDates(a?: string, b?: string) {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  try { computePair(a, b, 'ru'); return { a, b }; } catch { return null; }
}
export default function Compatibility() {
  const { me } = useMe();
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  return <CompatibilityScreen key={JSON.stringify([params.a, params.b, me?.birth])} initial={linkedDates(params.a, params.b)} />;
}
function CompatibilityScreen({ initial }: { initial: { a: string; b: string } | null }) {
  const { locale, t, session } = useApp();
  const { me } = useMe();
  const [a, setA] = useState(initial?.a ?? me?.birth ?? ''), [b, setB] = useState(initial?.b ?? '');
  const [chosen, setChosen] = useState(initial);
  useFocusEffect(useCallback(() => {
    if (!chosen) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { setChosen(null); return true; });
    return () => back.remove();
  }, [chosen]));
  if (chosen) return <ReaderPage tab contentsTitle={t('Разбор пары', 'Couple reading')} readerKey={`pair:${chosen.a}:${chosen.b}:${session?.user.id ?? 'guest'}`}>
    <ResultHeading title={t('Ваша матрица пары', 'Your couple’s chart')} eyebrow={t('Отношения и общие задачи', 'Relationships & shared purpose')}
      editLabel={t('Изменить даты', 'Edit dates')} onEdit={() => setChosen(null)} />
    <PairReading dates={chosen} />
  </ReaderPage>;
  return <Page tab><TabHeading title={t('Пара', 'Pair')} eyebrow={t('Матрица отношений', 'Your relationship chart')} /><Card style={{ gap: 22, padding: 22 }}>
    <Heading>{t('Две даты — одна история', 'Two dates, one story')}</Heading>
    <Heading>{DP.first[locale]}</Heading><DateFields prefix="partner-a" value={a} onChange={setA} />
    <Heading>{DP.second[locale]}</Heading><DateFields prefix="partner-b" value={b} onChange={setB} />
    <Action testID="calculate-pair" title={DP.submit[locale]} onPress={() => {
      const dates = { a: isoDate(a), b: isoDate(b) }; computePair(dates.a, dates.b, locale); Keyboard.dismiss(); setChosen(dates);
    }} />
  </Card></Page>;
}
