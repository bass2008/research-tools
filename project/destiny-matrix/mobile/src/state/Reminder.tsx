import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { dailyNative, defaultReminder } from '../native/dailyNative';
import { dailyContent } from '../daily/content';
import { useDailySelection } from '../daily/DailyProvider';
import { updateDailyWidget } from '../daily/DailyWidget';
import { useApp } from './AppState';
import { useMe } from './Me';

const Context = createContext({ state: defaultReminder, ready: false,
  change: async (_enabled: boolean, _hour?: number, _minute?: number) => false });

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { locale, ready: appReady } = useApp();
  const { me, ready: meReady } = useMe();
  const { dateKey } = useDailySelection();
  const [state, setState] = useState(defaultReminder);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!appReady || !meReady || !dailyNative) return;
    const native = dailyNative;
    let live = true;
    const refresh = async () => {
      const next = await native.configure(locale,
        Array.from({ length: 22 }, (_, index) => dailyContent(locale, index + 1).title));
      if (live) { setState(next); setReady(true); }
      await updateDailyWidget();
    };
    void refresh().catch(() => { if (live) setReady(false); });
    const subscription = AppState.addEventListener('change', value => {
      if (value === 'active') void refresh().catch(() => {});
    });
    return () => { live = false; subscription.remove(); };
  }, [locale, appReady, meReady, me?.birth, dateKey]);
  const change = useCallback(async (enabled: boolean, hour = state.hour, minute = state.minute) => {
    if (!dailyNative) return false;
    if (enabled && Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
      if (!await PermissionsAndroid.check(permission)
        && await PermissionsAndroid.request(permission) !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }
    const next = await dailyNative.setReminder(enabled, hour, minute);
    setState(next);
    return next.enabled === enabled;
  }, [state.hour, state.minute]);
  return <Context.Provider value={{ state, ready, change }}>{children}</Context.Provider>;
}

export const useReminder = () => useContext(Context);
