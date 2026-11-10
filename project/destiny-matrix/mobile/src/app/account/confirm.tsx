import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useApp } from '../../state/AppState';
import { isRecord } from '../../native/http';
import { Action, Body, Card, Page } from '../../components/ui';
import { AppLink } from '../../components/AppLink';
export default function Confirm() {
  const { token, kind } = useLocalSearchParams<{ token?: string; kind?: string }>();
  return <ConfirmLink key={JSON.stringify([kind, token])} token={token} kind={kind} />;
}

function ConfirmLink({ token, kind }: { token?: string; kind?: string }) {
  const { api, logout, t } = useApp();
  const [done, setDone] = useState('');
  return <Page title={t('Подтверждение почты', 'Email confirmation')}><Card>
    {done ? <Body>{done}</Body> : !token || !['verify_email', 'change_email'].includes(kind ?? '') ?
      <Body>{t('Ссылка неполная. Откройте её из письма.', 'The link is incomplete. Open it from your email.')}</Body> :
      <Action title={t('Подтвердить адрес', 'Confirm address')} onPress={async () => {
        const result = await api('/mobile/auth/confirm', isRecord, { method: 'POST', anonymous: true, body: { token, kind } });
        if (result.changed) await logout();
        setDone(result.changed ? t('Почта изменена. Войдите с новым адресом.', 'Email changed. Sign in with the new address.') : result.verified ? t('Почта подтверждена.', 'Email verified.') : t('Адрес подтверждён. Осталось подтверждение второго адреса.', 'Address confirmed. Confirmation of the other address is still required.'));
      }} />}
    <AppLink href="/account" label={t('В кабинет', 'Account')} />
  </Card></Page>;
}
