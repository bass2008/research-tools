import { useMemo } from 'react';
import { forLocale as matrixForLocale } from '@/lib/matrix';
import { pointsOf } from '@/lib/pair/engine';
import { isMobileSections } from '@/lib/mobileContentContract';
import { useMe } from './Me';
import { useApp } from './AppState';
import { useRemote } from './useRemote';
import { useProductAccess } from './useProductAccess';
import { isReadingList } from '../native/contracts';
import { matchingReading, personalReaderKey, type ReportParams } from '../native/personalReading';

export function useMyReading() {
  const { me } = useMe();
  const { locale, session } = useApp();
  const rights = useProductAccess('personal');
  const readings = useRemote(me && session ? '/readings' : null, isReadingList, { private: true });
  const saved = me ? matchingReading(readings.data?.items ?? [], me) : undefined;
  const calculation = useMemo(() => me
    ? matrixForLocale(locale).calculate(me.birth, me.sex) : null, [me, locale]);
  const points = useMemo<Record<string, number>>(() => calculation ? pointsOf(calculation) : {}, [calculation]);
  const params: ReportParams = saved ? { id: String(saved.id) } : { birth: me?.birth, sex: me?.sex };
  const slug = calculation ? `${calculation.day}-${calculation.month}-${calculation.year}` : null;
  const path = saved ? `/sections?m=${saved.id}`
    : slug ? `/sections?${rights.unlimited ? '' : 'preview=free&'}slug=${slug}` : null;
  const privateContent = !!saved || rights.unlimited;
  const remote = useRemote(path, isMobileSections, {
    private: privateContent,
    grant: () => privateContent && session
      ? { userId: session.user.id, until: saved ? saved.access_until : rights.until } : undefined,
  });
  return { me, calculation, points, params, readerKey: personalReaderKey({ birth: me?.birth, sex: me?.sex }, session?.user.id),
    sections: remote.data?.sections, remote };
}
