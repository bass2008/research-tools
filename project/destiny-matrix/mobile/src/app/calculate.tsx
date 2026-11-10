import { useState } from 'react';
import { router } from 'expo-router';
import { Keyboard, Text, View } from 'react-native';
import { forLocale as matrixForLocale, type Sex } from '@/lib/matrix';
import { D } from '@/lib/i18n';
import { useMe } from '../state/Me';
import { useApp } from '../state/AppState';
import { useDesign } from '../state/Design';
import { DateFields, isoDate } from '../components/DateFields';
import { Action, Body, Card, Heading, Page, Segments, fonts } from '../components/ui';
import { DisplayTitle, Kicker } from '../components/DesignElements';
import { AppLink } from '../components/AppLink';

export default function Calculator() {
  const { locale, t } = useApp(); const { design } = useDesign();
  const { me, saveMe } = useMe();
  const [birth, setBirth] = useState(''); const [sex, setSex] = useState<Sex>('f');
  const date = <DateFields value={birth} onChange={setBirth} />;
  const identity = <View style={{ gap: 9 }}><Body muted>{t('Пол для расчёта', 'Sex used for the calculation')}</Body>
    <Segments value={sex} onChange={setSex} options={[{ value: 'f', label: D.calc.female[locale], testID: 'sex-f' }, { value: 'm', label: D.calc.male[locale], testID: 'sex-m' }]} /></View>;
  const submit = <Action testID="calculate" title={D.calc.submit[locale]} onPress={async () => {
    const value = isoDate(birth); matrixForLocale(locale).calculate(value, sex); Keyboard.dismiss();
    if (!me) {
      await saveMe({ birth: value, sex });
      router.replace({ pathname: '/matrix', params: { point: '', chapter: '', selection: String(Date.now()) } });
      return;
    }
    router.push({ pathname: '/report', params: { birth: value, sex } });
  }} />;
  return <Page scene="date">
    <>
      <Kicker>{t('Личная матрица · первая страница', 'Your personal chart · page one')}</Kicker>
      <DisplayTitle>{t('Начните\nс вашей даты.', 'Begin with\nyour date.')}</DisplayTitle>
      <Card style={{ padding: 22, gap: 22, borderTopWidth: 3, borderTopColor: design.gold }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14 }}><Text style={{ fontFamily: fonts.display, fontSize: 33, color: '#8c6c29' }}>I.</Text><View style={{ flex: 1 }}><Heading>{D.calc.formTitle[locale]}</Heading></View></View>
        {date}<View style={{ borderTopWidth: 1, borderColor: design.border, paddingTop: 18 }}>{identity}</View>{submit}
      </Card>
    </>

    <Body muted>{t('Схема рассчитывается на устройстве. При сохранении или покупке разбора дата передаётся в ваш аккаунт.', 'Your chart is calculated on your device. Saving or buying a reading sends the date to your account.')}</Body>
    <AppLink href="/encyclopedia/demo?view=reading" label={t('Сначала посмотреть пример', 'Explore a sample first')} />
  </Page>;
}
