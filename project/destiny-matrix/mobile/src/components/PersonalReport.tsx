import { useEffect, useState } from 'react';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { pointsOf } from '@/lib/pair/engine';
import { useApp } from '../state/AppState';
import { usePersonalReport } from '../state/usePersonalReport';
import { useReadingProgress } from '../state/useReadingProgress';
import { isReading } from '../native/contracts';
import { authHref } from '../native/authReturn';
import { chapterHref, type ReportParams } from '../native/personalReading';
import { Action, Body, Card, Field, Heading, Page, RemoteStatus } from './ui';
import { AppLink } from './AppLink';
import { PersonalChart } from './PersonalChart';
import { TabHeading } from './TabHeading';
import { ChartCover } from './ChartCover';
import { ReadingActions } from './ReadingActions';
import { ChapterContents } from './ChapterContents';
import { ShareCard } from './ShareCard';

export function PersonalReport({ params, tab = false }: { params: ReportParams; tab?: boolean }) {
  const { session, api, t } = useApp();
  const { calculation, sections, remote, saved, rights, readerKey, engine } = usePersonalReport(params);
  const { readKeys } = useReadingProgress(readerKey);
  const [title, setTitle] = useState('');
  const openChapter = (key: string) => router.push(chapterHref(params, key) as Href);
  const initialHref = params.chapter ? chapterHref(params, params.chapter) : null;
  useEffect(() => {
    if (initialHref) router.push(initialHref as Href);
  }, [initialHref]);
  return <Page tab={tab} title={tab ? undefined : saved.data?.row.title ?? t('Ваша матрица', 'Your matrix')}>
    {tab && <TabHeading title={t('Матрица', 'Matrix')} />}
    {tab && calculation && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
      <AppLink href="/my-date" label={t('Изменить', 'Edit')} />
    </View>}
    {tab && calculation && <PersonalChart points={pointsOf(calculation)} sections={sections}
      birthLabel={engine.birthLabel(calculation.birth)} initialPoint={params.point} onReadChapter={openChapter} />}
    {tab && calculation && <ShareCard content={{ kind: 'matrix', birth: calculation.birth, points: pointsOf(calculation) }} />}
    {!tab && calculation && <ChartCover title={t('Личная матрица', 'Personal matrix')}
      dates={calculation.birth ? [engine.birthLabel(calculation.birth)] : []} points={pointsOf(calculation)}
      subtitle={saved.data?.row.unlocked || rights.unlimited ? t('Полный разбор', 'Full reading') : t('Знакомство с собой', 'Getting to know yourself')} />}
    {params.id && !session ? <AppLink testID="report-auth"
      href={authHref('login', `/report?${new URLSearchParams({ id: params.id })}`)}
      label={t('Войти, чтобы открыть разбор', 'Sign in to open your reading')} /> : <RemoteStatus {...remote} />}
    {!calculation && !remote.loading && !remote.error && (!params.id || session)
      && <Body>{t('Проверьте дату рождения', 'Check the birth date')}</Body>}
    {saved.data && <ReadingActions id={saved.data.row.id} unlocked={!!saved.data.row.unlocked} until={saved.data.row.access_until} />}
    {sections && <View style={{ gap: 8 }}>
      <Heading>{t('Мой разбор', 'My reading')}</Heading>
      <Body muted>{t(`Глав: ${sections.length} · прочитано ${readKeys.filter(key => sections.some(s => s.key === key && !s.locked)).length}`,
        `${sections.length} chapters · ${readKeys.filter(key => sections.some(s => s.key === key && !s.locked)).length} read`)}</Body>
      <ChapterContents sections={sections} readKeys={readKeys} onSelect={openChapter} />
    </View>}
    {!params.id && calculation && !params.slug && <Card>{session ? <>
      <Field label={t('Имя или подпись (необязательно)', 'Name or label (optional)')}
        value={title} onChangeText={setTitle} maxLength={200} />
      <Action testID="save-reading" title={t('Сохранить в кабинете', 'Save to account')} onPress={async () => {
        const row = await api('/readings', isReading, { method: 'POST',
          body: { product: 'personal', inputs: { birth: calculation.birth, sex: calculation.sex }, title } });
        router.replace({ pathname: '/report', params: { id: row.id } });
      }} />
    </> : <AppLink testID="save-reading-auth"
      href={authHref('login', `/report?${new URLSearchParams({ birth: calculation.birth, sex: calculation.sex })}`)}
      label={t('Войти и сохранить матрицу', 'Sign in to save the matrix')} />}</Card>}
  </Page>;
}
