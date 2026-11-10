import { useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router } from 'expo-router';
import { forLocale as matrixForLocale, type Sex } from '@/lib/matrix';
import { D } from '@/lib/i18n';
import { useApp } from '../state/AppState';
import { useMe } from '../state/Me';
import { DateFields, isoDate } from './DateFields';
import { Action, Body, Segments } from './ui';

export function MyDateForm({ editing = false }: { editing?: boolean }) {
  const { me, saveMe } = useMe();
  const { locale, t } = useApp();
  const [birth, setBirth] = useState(me?.birth ?? '');
  const [sex, setSex] = useState<Sex>(me?.sex ?? 'f');
  return <View style={{ gap: 18 }}>
    <DateFields value={birth} onChange={setBirth} />
    <View style={{ gap: 8 }}>
      <Body muted>{t('Пол для расчёта', 'Sex used for the calculation')}</Body>
      <Segments value={sex} onChange={setSex} options={[
        { value: 'f', label: D.calc.female[locale], testID: 'sex-f' },
        { value: 'm', label: D.calc.male[locale], testID: 'sex-m' },
      ]} />
    </View>
    <Action testID="calculate" title={editing
      ? t('Сохранить', 'Save') : t('Построить мою матрицу', 'Build my matrix')}
      onPress={async () => {
        const value = isoDate(birth);
        matrixForLocale(locale).calculate(value, sex);
        await saveMe({ birth: value, sex });
        Keyboard.dismiss();
        router.replace({ pathname: '/matrix', params: { point: '', chapter: '', selection: String(Date.now()) } });
      }} />
  </View>;
}
