import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useApp } from '../../state/AppState';
import { useRemote } from '../../state/useRemote';
import { isReading } from '../../native/contracts';
import { record } from '../../native/http';
import { authHref } from '../../native/authReturn';
import { PairReading } from '../../components/PairReading';
import { AppLink } from '../../components/AppLink';
import { Body, RemoteStatus } from '../../components/ui';
import { ReaderPage } from '../../components/ReaderNavigation';
export default function Reading() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { session, t, invalidateAccess } = useApp();
  const row = useRemote(id ? `/readings/${id}` : null, isReading, { private: true });
  const data = row.data;
  const savedId = data?.id, savedOpen = data?.unlocked;
  const revoked = useRef<number | null>(null);
  useEffect(() => {
    if (savedId && savedOpen === false && revoked.current !== savedId) { revoked.current = savedId; invalidateAccess(savedId); }
    else if (savedId && savedOpen) revoked.current = null;
  }, [savedId, savedOpen, invalidateAccess]);
  if (data?.product === 'personal') return <Redirect href={{ pathname: '/report', params: { id } }} />;
  const a = data?.inputs.a, b = data?.inputs.b;
  return <ReaderPage contentsTitle={t('Разбор пары', 'Couple reading')} readerKey={`saved-pair:${id}:${session?.user.id ?? 'guest'}`} title={data?.title ?? t('Разбор пары', 'Couple reading')}>
    {!session ? <AppLink testID="reading-auth" href={authHref('login', `/reading/${id}`)} label={t('Войти', 'Sign in')} /> : <><RemoteStatus {...row} />
      {data && record(a) && record(b) && typeof a.birth === 'string' && typeof b.birth === 'string' ?
        <PairReading dates={{ a: a.birth, b: b.birth }} id={data.id} unlocked={!!data.unlocked} until={data.access_until} /> : data && <Body>{t('Этот вид разбора пока открывается на сайте.', 'This reading type is currently available on the website.')}</Body>}
    </>}
  </ReaderPage>;
}
