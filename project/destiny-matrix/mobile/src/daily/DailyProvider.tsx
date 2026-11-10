import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { millisecondsUntilTomorrow, selectionForDate, type DailySelection } from './calendar';

const Context = createContext<DailySelection | null>(null);
export function DailyProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState(() => selectionForDate(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
    const refresh = () => {
      clear();
      const now = new Date(), next = selectionForDate(now);
      setSelection(previous => previous.dateKey === next.dateKey ? previous : next);
      timer = setTimeout(refresh, millisecondsUntilTomorrow(now));
    };
    const state = AppState.addEventListener('change', value => { if (value === 'active') refresh(); else clear(); });
    const focus = AppState.addEventListener('focus', refresh);
    if (AppState.currentState !== 'background') refresh();
    return () => { clear(); state.remove(); focus.remove(); };
  }, []);
  return <Context.Provider value={selection}>{children}</Context.Provider>;
}
export function useDailySelection(): DailySelection {
  const selection = useContext(Context);
  // Standalone previews/tests can render a screen; the app always uses the provider.
  return selection ?? selectionForDate(new Date());
}
