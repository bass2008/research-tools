import { useEffect, useMemo, useRef } from 'react';
import { forLocale as matrixForLocale } from '@/lib/matrix';
import { isMobileSections, type MobileSections } from '@/lib/mobileContentContract';
import type { ReadingItem } from '@/lib/api';
import { useApp } from './AppState';
import { useRemote } from './useRemote';
import { useProductAccess } from './useProductAccess';
import { ApiError, record } from '../native/http';
import { isReading } from '../native/contracts';
import { dropCache } from '../native/cache';
import { personalReaderKey, type ReportParams } from '../native/personalReading';

interface SavedReport { row: ReadingItem; report: MobileSections }
const isSavedReport = (v: unknown): v is SavedReport => record(v) && isReading(v.row) && isMobileSections(v.report);
export function usePersonalReport(params: ReportParams) {
  const { locale, session, api, base, t, invalidateAccess } = useApp();
  const rights = useProductAccess('personal');
  const engine = matrixForLocale(locale);
  const saved = useRemote(params.id ? `/mobile/report/${params.id}` : null, isSavedReport, {
    private: true,
    grant: value => session ? { userId: session.user.id, until: value.row.access_until, readingId: value.row.id } : undefined,
    load: async () => {
      const row = await api(`/readings/${params.id}`, isReading);
      if (row.product !== 'personal') throw new ApiError(404, t('Личная матрица не найдена', 'Personal matrix not found'));
      if (!row.unlocked) dropCache(JSON.stringify([1, base, locale, `/mobile/report/${params.id}`, session?.user.id ?? null]));
      const birth = row.birth ?? String(row.inputs.birth);
      const matrix = engine.calculate(birth, (row.sex ?? row.inputs.sex) === 'm' ? 'm' : 'f');
      const report = await api(row.unlocked ? `/sections?m=${row.id}` : `/sections?preview=free&slug=${matrix.day}-${matrix.month}-${matrix.year}`, isMobileSections);
      return { row, report };
    },
  });
  const savedId = saved.data?.row.id, savedOpen = saved.data?.row.unlocked;
  const revoked = useRef<number | null>(null);
  useEffect(() => {
    if (savedId && savedOpen === false && revoked.current !== savedId) { revoked.current = savedId; invalidateAccess(savedId); }
    else if (savedId && savedOpen) revoked.current = null;
  }, [savedId, savedOpen, invalidateAccess]);
  const calculation = useMemo(() => {
    try {
      const row = saved.data?.row;
      if (params.id && !row) return null;
      if (!params.birth && params.slug && !row) {
        const nums = params.slug.split('-').map(Number);
        if (nums.length !== 3 || nums.some(n => !Number.isInteger(n) || n < 1 || n > 22)) return null;
        return engine.fromPoints(nums[0], nums[1], nums[2], '');
      }
      return engine.calculate(row?.birth ?? String(row?.inputs.birth ?? params.birth ?? ''), (row?.sex ?? row?.inputs.sex ?? params.sex) === 'm' ? 'm' : 'f');
    } catch { return null; }
  }, [engine, params.birth, params.id, params.sex, params.slug, saved.data]);
  const slug = calculation ? `${calculation.day}-${calculation.month}-${calculation.year}` : null;
  const free = useRemote(!params.id && slug ? `/sections?${rights.unlimited ? '' : 'preview=free&'}slug=${slug}` : null, isMobileSections,
    { private: rights.unlimited, grant: () => rights.unlimited && session ? { userId: session.user.id, until: rights.until } : undefined });
  const remote = params.id ? saved : free;
  const sections = saved.data?.report.sections ?? free.data?.sections;
  const readerKey = personalReaderKey(calculation?.birth ? { birth: calculation.birth, sex: calculation.sex } : params, session?.user.id);
  return { calculation, sections, remote, saved, rights, readerKey, engine };
}
