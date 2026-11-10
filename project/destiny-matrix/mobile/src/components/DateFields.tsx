import { View, type TextStyle } from 'react-native';
import { Field, fonts, styles } from './ui';
import { useApp } from '../state/AppState';

export function DateFields({ value, onChange, prefix = 'birth', label }: { value: string; onChange: (v: string) => void; prefix?: string; label?: string }) {
  const { t } = useApp();
  const [year = '', month = '', day = ''] = value.split('-');
  const put = (part: number, v: string) => { const date = [year, month, day]; date[part] = v.replace(/\D/g, ''); onChange(date.join('-')); };
  const input: TextStyle = {
    textAlign: 'center', paddingHorizontal: 6, minHeight: 56,
    fontVariant: ['tabular-nums'], borderWidth: 0, borderBottomWidth: 1,
    borderRadius: 0, backgroundColor: 'transparent', fontFamily: fonts.display, fontSize: 27,
  };
  return <View style={styles.row}>
    <View style={{ flex: 1 }}><Field label={label ? `${label} · ${t('День', 'Day')}` : t('День', 'Day')} testID={`${prefix}-day`} value={day} onChangeText={v => put(2, v)} keyboardType="number-pad" selectTextOnFocus maxLength={2} placeholder={t('ДД', 'DD')} style={input} /></View>
    <View style={{ flex: 1 }}><Field label={t('Месяц', 'Month')} testID={`${prefix}-month`} value={month} onChangeText={v => put(1, v)} keyboardType="number-pad" selectTextOnFocus maxLength={2} placeholder={t('ММ', 'MM')} style={input} /></View>
    <View style={{ flex: 1.3 }}><Field label={t('Год', 'Year')} testID={`${prefix}-year`} value={year} onChangeText={v => put(0, v)} keyboardType="number-pad" selectTextOnFocus maxLength={4} placeholder={t('ГГГГ', 'YYYY')} style={input} /></View>
  </View>;
}
export function isoDate(value: string) { const [y = '', m = '', d = ''] = value.split('-'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
