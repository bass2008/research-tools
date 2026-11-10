import { useState } from 'react';
import { Alert, Linking, Pressable, Switch, Text, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useApp } from '../state/AppState';
import { useReminder } from '../state/Reminder';
import { reminderTime } from '../native/dailyNative';
import { Body, Card, Heading, colors, fonts } from './ui';

export function ReminderSetting({ settings = false }: { settings?: boolean }) {
  const { t } = useApp();
  const { state, ready, change } = useReminder();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const time = reminderTime(state);
  const label = t(`Напоминать о теме дня в ${time}`, `Remind me of today’s theme at ${time}`);
  const update = async (enabled: boolean, hour?: number, minute?: number) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!await change(enabled, hour, minute)) Alert.alert(
        t('Разрешите уведомления', 'Allow notifications'),
        t('Включите уведомления Arcana Sense в настройках телефона.', 'Enable Arcana Sense notifications in your phone settings.'),
        [{ text: t('Позже', 'Later'), style: 'cancel' },
          { text: t('Настройки', 'Settings'), onPress: () => { void Linking.openSettings(); } }]);
    } catch { setError(t('Не удалось сохранить напоминание. Попробуйте ещё раз.', 'Could not save the reminder. Please try again.')); }
    finally { setBusy(false); }
  };
  const row = <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.ink }}>{label}</Text>
      <Switch testID="reminder-toggle" accessibilityLabel={label} value={state.enabled}
        disabled={!ready || busy} onValueChange={value => { void update(value); }}
        trackColor={{ false: '#d9d3c6', true: '#087b75' }} thumbColor="#fffaf0" />
    </View>
    {!!error && <Body>{error}</Body>}
  </View>;
  if (!settings) return row;
  return <Card><Heading>{t('Утреннее напоминание', 'Morning reminder')}</Heading>
    {row}
    <Pressable testID="reminder-time" accessibilityRole="button" disabled={!ready || busy}
      accessibilityLabel={t(`Изменить время, ${time}`, `Change time, ${time}`)}
      onPress={() => DateTimePickerAndroid.open({ value: new Date(2026, 0, 1, state.hour, state.minute),
        mode: 'time', is24Hour: true, onChange: (event, date) => {
          if (event.type === 'set' && date) void update(state.enabled, date.getHours(), date.getMinutes());
        } })} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, color: colors.teal, fontSize: 14 }}>
        {t(`Изменить время · ${time}`, `Change time · ${time}`)}
      </Text>
    </Pressable>
  </Card>;
}
