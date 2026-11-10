import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { forLocale as matrixForLocale, type Sex } from '@/lib/matrix';

export interface MyDate { birth: string; sex: Sex }
const Context = createContext<{
  me: MyDate | null;
  ready: boolean;
  saveMe: (value: MyDate) => Promise<void>;
}>({ me: null, ready: true, saveMe: async () => {} });

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MyDate | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void SecureStore.getItemAsync('arcana.me').then(raw => {
      if (!raw) return;
      const value = JSON.parse(raw) as MyDate;
      if (value.sex !== 'f' && value.sex !== 'm') return;
      matrixForLocale('ru').calculate(value.birth, value.sex);
      if (live) setMe({ birth: value.birth, sex: value.sex });
    }).catch(() => {}).finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  const saveMe = useCallback(async (value: MyDate) => {
    matrixForLocale('ru').calculate(value.birth, value.sex);
    await SecureStore.setItemAsync('arcana.me', JSON.stringify(value));
    setMe(value);
  }, []);
  return <Context.Provider value={{ me, ready, saveMe }}>{children}</Context.Provider>;
}

export const useMe = () => useContext(Context);
