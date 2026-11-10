import { useCallback, useMemo, useState } from 'react';
import { BackHandler, Keyboard, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { forLocale as matrixForLocale } from '@/lib/matrix';
import { yearPoints } from '@/lib/yearMatrix';
import { yearModel } from '@/lib/yearLinks';
import { D } from '@/lib/i18n';
import { useMe } from '../state/Me';
import { useApp } from '../state/AppState';
import { useRemote } from '../state/useRemote';
import { isNumberTextMap } from '../native/contracts';
import { AppLink } from '../components/AppLink';
import { DateFields, isoDate } from '../components/DateFields';
import { ChartCover } from '../components/ChartCover';
import { TabHeading } from '../components/TabHeading';
import { ArcanumImage } from '../components/ArcanumImage';
import { Action, Body, Card, Field, Heading, Page, RemoteStatus, RichText } from '../components/ui';
import { ResultHeading } from '../components/ResultHeading';

export default function Year() {
  const { locale, t } = useApp();
  const { me } = useMe();
  const params = useLocalSearchParams<{ birth?: string; year?: string }>();
  const [birth, setBirth] = useState(params.birth ?? me?.birth ?? '');
  const [year, setYear] = useState(params.year ?? String(new Date().getFullYear()));
  const [chosen, setChosen] = useState<{ birth: { y: number; m: number; d: number }; year: number } | null>(() => {
    if (!params.birth) return null;
    try {
      matrixForLocale(locale).calculate(params.birth, 'f');
      const [y, m, d] = params.birth.split('-').map(Number);
      const forecast = Number(params.year ?? new Date().getFullYear());
      return Number.isInteger(forecast) && forecast >= 1900 && forecast <= 2200
        ? { birth: { y, m, d }, year: forecast } : null;
    } catch { return null; }
  });
  const model = useMemo(() => chosen ? yearModel(locale, chosen.birth, chosen.year) : null, [chosen, locale]);
  const points = useMemo(() => chosen ? yearPoints(chosen.birth, chosen.year) : null, [chosen]);
  const meanings = useRemote(chosen ? '/year-meanings' : null, isNumberTextMap);
  useFocusEffect(useCallback(() => {
    if (!chosen) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { setChosen(null); return true; });
    return () => back.remove();
  }, [chosen]));
  return <Page key={chosen ? 'result' : 'form'}>{!chosen ? <><TabHeading title={t('Ваш год', 'Your year')} eyebrow={t('Ваш личный ритм', 'Your personal rhythm')} /><Card style={{ gap: 22, padding: 22 }}>
    <Heading>{t('Дата и год прогноза', 'Birth date and forecast year')}</Heading>
    <DateFields value={birth} onChange={setBirth} />
    <Field testID="forecast-year" label={t('Год прогноза', 'Forecast year')} keyboardType="number-pad" value={year} onChangeText={setYear} selectTextOnFocus maxLength={4} />
    <Action testID="calculate-year" title={t('Рассчитать год', 'Calculate year')} onPress={() => {
      const date = isoDate(birth); matrixForLocale(locale).calculate(date, 'f');
      const n = Number(year); if (!Number.isInteger(n) || n < 1900 || n > 2200) throw new Error(t('Выберите год от 1900 до 2200', 'Choose a year from 1900 to 2200'));
      const [y, m, d] = date.split('-').map(Number); Keyboard.dismiss(); setChosen({ birth: { y, m, d }, year: n });
    }} />
  </Card></> : points && model && <>
    <ResultHeading title={t('Ваш личный год', 'Your personal year')} eyebrow={t('Ритм и возможности', 'Rhythm & possibilities')}
      editLabel={t('Изменить', 'Edit details')} onEdit={() => setChosen(null)} />
    <ChartCover title={t('Прогноз на год', 'Year forecast')} dates={[String(chosen.year)]}
      subtitle={matrixForLocale(locale).birthLabel(`${chosen.birth.y}-${String(chosen.birth.m).padStart(2, '0')}-${String(chosen.birth.d).padStart(2, '0')}`)}
      points={points} year links={model.links}
      caption={model.copy.sub.replace('в браузере', 'на устройстве').replace('in your browser', 'on your device')} />
    <RemoteStatus {...meanings} />
    {(['E', 'P1', 'P2', 'P3'] as const).map(key => <Card key={key}><View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}><ArcanumImage n={points[key]} width={68} decorative /><View style={{ flex: 1 }}><Heading>{D.yearLinks.points[locale][key][0]} · {points[key]}</Heading></View></View>
      {meanings.data?.[points[key]] && <RichText text={meanings.data[points[key]]} />}
      <AppLink href={`/year/${points[key]}`} label={t('Значение аркана на год', 'Meaning of this year arcanum')} />
    </Card>)}
    <Heading>{model.copy.title}</Heading>{model.accent && <Body>{model.accent}</Body>}
    {model.links.map(link => <Card key={link.keys.join('-')}><Heading>{link.n} · {link.keys.map(k => model.role(k)).join(', ')}</Heading>
      <Body muted>{model.rarity(link.p)}</Body>{model.explain(link, n => String(n)).map((p, i) => <RichText key={i} text={p} />)}
      <AppLink href={`/year/${link.n}`} label={model.moreTitle(link.n)} />
    </Card>)}
  </>}</Page>;
}
