import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../state/Me';
import { useApp } from '../state/AppState';
import { useBilling } from '../state/Billing';
import { useRemote } from '../state/useRemote';
import { isSession, isUser } from '../native/contracts';
import { isRecord } from '../native/http';
import { config } from '../native/config';
import { sendErrorProbe, sendNativeCrashProbe } from '../native/errors';
import { AppLink } from '../components/AppLink';
import { ReminderSetting } from '../components/ReminderSetting';
import { Action, Body, Card, Field, Heading, Page, RemoteStatus, Segments, styles } from '../components/ui';

export default function Settings() {
  const { me: myDate } = useMe();
  const app = useApp(); const { session, t, api, locale, setLocale } = app;
  const billing = useBilling();
  const [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [email, setEmail] = useState('');
  const [base, setBase] = useState(app.base), [notice, setNotice] = useState('');
  const me = useRemote(session && !session.deletion ? '/auth/me' : null, isUser, { private: true });
  const hasPassword = (me.data?.user.has_password ?? session?.user.has_password) !== false;
  const deletion = useRemote(session?.deletion ? '/mobile/account/deletion' : null, isRecord, { cache: false });
  const cancellation = (isRecord(deletion.data?.deletion) ? deletion.data.deletion.renewal_cancellation : null) ?? session?.deletion?.renewal_cancellation;
  return <Page key={session?.deletion ? 'deletion' : 'settings'} title={t('Настройки', 'Settings')}>
    <ReminderSetting settings />
    <Card><Heading>{t('Моя дата', 'My birth date')}</Heading>
      {myDate && <Body>{myDate.birth.split('-').reverse().join('.')}</Body>}
      <AppLink href="/my-date" label={t('Изменить', 'Edit')} />
    </Card><Card><Heading>{t('Язык', 'Language')}</Heading>
    <Segments value={locale} onChange={setLocale} options={[{ value: 'ru', label: 'Русский', testID: 'language-ru' }, { value: 'en', label: 'English', testID: 'language-en' }]} />
  </Card>{notice && <Body>{notice}</Body>}
    {session?.deletion ? <Card><Heading>{t('Удаление аккаунта запрошено', 'Account deletion requested')}</Heading>
      <Body>{t('Удаляется общий аккаунт сайта и приложения. Данные будут удалены через 30 дней. До этого срока аккаунт можно восстановить.', 'This deletes your shared website and app account. Your data will be deleted after 30 days. You can restore the account before then.')}</Body>
      <Body>{new Date(session.deletion.delete_at).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-GB')}</Body>
      <RemoteStatus {...deletion} />
      <Body>{cancellation === 'complete'
        ? t('Автопродление отключено.', 'Automatic renewal is disabled.') : t('Отключение автопродления ожидает подтверждения Google. Сервер повторит попытку.', 'Google has not confirmed cancellation yet. The server will retry.')}</Body>
      {cancellation !== 'complete' && <AppLink testID="deletion-manage-subscription"
        href="https://play.google.com/store/account/subscriptions?sku=month&package=com.arcanasense.app"
        label={t('Управлять подпиской в Google Play', 'Manage subscription in Google Play')} />}
      <Action testID="restore-account" title={t('Восстановить аккаунт', 'Restore account')} onPress={async () => {
        await app.authenticate(await api('/mobile/account/restore', isSession, { method: 'POST', body: {} }));
        setNotice(t('Аккаунт восстановлен. Автопродление остаётся выключенным.', 'Account restored. Automatic renewal remains disabled.')); router.replace('/account');
      }} />
    </Card> : session ? <>
      <Card><Heading>{t('Аккаунт', 'Account')}</Heading><Body>{session.user.email}</Body>
        <RemoteStatus {...me} />
        {!me.data?.user.email_verified_at && <Action secondary title={t('Подтвердить почту', 'Verify email')} onPress={async () => {
          await api('/auth/email/verification/request', isRecord, { method: 'POST', body: {} }); setNotice(t('Письмо отправлено. Перейдите по ссылке в письме.', 'Email sent. Follow the confirmation link.'));
        }} />}
        {!hasPassword && <>
          <Body>{t('Вы вошли через Google и ещё не задали пароль Arcana Sense. Для смены почты или удаления аккаунта сначала задайте пароль по ссылке в письме. Вход через Google сохранится.', 'You signed in with Google and have not set an Arcana Sense password. To change your email or delete your account, first set a password using the email link. Google sign-in will remain available.')}</Body>
          <Action secondary testID="set-account-password" title={t('Задать пароль по почте', 'Set a password by email')} onPress={async () => {
            await api('/auth/reset/request', isRecord, { method: 'POST', anonymous: true, body: { email: me.data?.user.email ?? session.user.email } });
            setNotice(t('Письмо со ссылкой для создания пароля отправлено. Проверьте также папку «Спам».', 'A link to set your password has been sent. Check your spam folder too.'));
          }} />
        </>}
        {hasPassword && <><Field label={t('Текущий пароль', 'Current password')} testID="current-password" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
        <Field label={t('Новый пароль', 'New password')} testID="new-password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
        <Action secondary testID="change-password" title={t('Изменить пароль', 'Change password')} onPress={async () => {
          const result = await api('/auth/password/change', isSession, { method: 'POST', body: { current_password: current, new_password: password } });
          await app.authenticate(result); setCurrent(''); setPassword(''); setNotice(t('Пароль изменён.', 'Password changed.'));
        }} />
        <Field label={t('Новая почта', 'New email')} testID="new-email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Action secondary title={t('Изменить почту', 'Change email')} onPress={async () => {
          await api('/auth/email/change/request', isRecord, { method: 'POST', body: { current_password: current, new_email: email } });
          setNotice(t('Письма с подтверждением отправлены. Адрес изменится после необходимых подтверждений.', 'Confirmation emails sent. Your address changes after the required confirmations.'));
        }} /></>}
      </Card>
      <Card><Heading>{t('Покупки', 'Purchases')}</Heading><Action secondary title={t('Восстановить покупки', 'Restore purchases')} onPress={async () => { await billing.restore(); setNotice(t('Покупки проверены.', 'Purchases checked.')); }} />
        {billing.status?.subscriptions.map(s => <Body key={s.order_id}>{s.expires_at ? `${t('До', 'Until')} ${new Date(s.expires_at).toLocaleDateString()}` : ''} · {s.auto_renewing ? t('С автопродлением', 'Renews automatically') : t('Без автопродления', 'Renewal disabled')}</Body>)}
        {billing.status?.provider === 'google_play' && !!billing.status.subscriptions.length && <Action secondary title={t('Управлять подпиской в Google Play', 'Manage subscription in Google Play')} onPress={async () => {
          const { deepLinkToSubscriptions } = await import('expo-iap'); await deepLinkToSubscriptions({ skuAndroid: 'month', packageNameAndroid: 'com.arcanasense.app' });
        }} />}
      </Card>
      <Card><Heading>{t('Удаление аккаунта', 'Delete account')}</Heading>
        <Body>{t('Удаляется общий аккаунт сайта и приложения. Удаление отключит автопродление подписки и доступ к кабинету. Через 30 дней персональные данные будут удалены. В течение этого срока можно восстановить аккаунт; автопродление не включится автоматически.', 'This deletes your shared website and app account. Deletion disables subscription renewal and account access. Personal data is erased after 30 days. You can restore the account during that time; renewal will not resume automatically.')}</Body>
        <Body muted>{hasPassword ? t('Для подтверждения используйте поле текущего пароля выше.', 'Use the current password field above to confirm.') : t('Сначала задайте пароль с помощью кнопки выше, затем подтвердите им удаление.', 'First set a password using the button above, then use it to confirm deletion.')}</Body>
        <Action secondary disabled={!hasPassword} testID="delete-account" title={t('Запросить удаление', 'Request deletion')} onPress={() => {
          Alert.alert(t('Удалить аккаунт?', 'Delete account?'), t('Удаляется общий аккаунт сайта и приложения. Автопродление будет отключено.', 'This deletes your shared website and app account. Automatic renewal will be disabled.'), [
            { text: t('Отмена', 'Cancel'), style: 'cancel' }, { text: t('Удалить аккаунт', 'Delete account'), style: 'destructive', onPress: () => {
              void api('/mobile/account/delete', isSession, { method: 'POST', body: { current_password: current } }).then(app.authenticate)
                .then(() => { setCurrent(''); setPassword(''); setNotice(''); }).catch(e => Alert.alert(t('Не удалось удалить', 'Unable to delete'), e.message));
            } },
          ]);
        }} />
      </Card>
    </> : <Card><Heading>{t('Аккаунт', 'Account')}</Heading><AppLink href="/login" label={t('Войти', 'Sign in')} /></Card>}
    {session && <Action secondary testID="logout" title={t('Выйти', 'Sign out')} onPress={async () => { await app.logout(); router.replace('/account'); }} />}
    <Card><AppLink href="/support" label={t('Поддержка', 'Support')} /><AppLink href="/contacts" label={t('Контакты', 'Contact')} /><AppLink href="/privacy" label={t('Конфиденциальность', 'Privacy')} /><AppLink href="/terms" label={t('Условия', 'Terms')} /></Card>
    {config.local && <Card><Heading>{t('Локальная проверка', 'Local testing')}</Heading>
      <Field testID="server-address" label={t('Адрес сервера', 'Server address')} value={base} onChangeText={setBase} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <Action secondary title={t('Подключиться (выход из аккаунта)', 'Connect (signs out)')} onPress={async () => { await app.setBase(base); setNotice(t('Адрес сохранён.', 'Server saved.')); }} />
      {billing.status?.provider === 'mock' && <><Body>{t('Страна тестового магазина', 'Mock storefront country')}: {billing.country}</Body><View style={styles.row}>
        <Action testID="mock-country-ru" title="RU" secondary onPress={() => billing.setMockCountry('RU')} /><Action testID="mock-country-us" title="US" secondary onPress={() => billing.setMockCountry('US')} />
      </View>{billing.receipt && <><Body>{billing.receipt.state}</Body>{(['pending', 'purchased', 'refunded', 'grace', 'hold', 'expired', 'renewed', 'canceled'] as const).map(state =>
        <Action key={state} testID={`mock-${state}`} title={`Mock: ${state}`} secondary onPress={() => billing.simulate(state)} />)}</>}</>}
      {!!billing.error && <Body muted>{billing.error}</Body>}
      {config.errorsDsn && <Action secondary testID="error-probe" title={t('Проверить доставку ошибки', 'Test error delivery')} onPress={async () => { await sendErrorProbe(); setNotice(t('Тестовая ошибка отправлена.', 'Test error sent.')); }} />}
      {config.errorsDsn && <Action secondary testID="native-error-probe" title={t('Проверить native crash · приложение закроется', 'Test native crash · app will close')} onPress={() => {
        Alert.alert(t('Проверка сбоя Android', 'Android crash test'), t('Приложение закроется. Откройте его снова для отправки отчёта о тестовом сбое.', 'The app will close. Reopen it to send the test crash report.'), [
          { text: t('Отмена', 'Cancel'), style: 'cancel' },
          { text: t('Вызвать тестовый сбой', 'Test native crash'), style: 'destructive', onPress: sendNativeCrashProbe },
        ]);
      }} />}
    </Card>}
    <Body muted>{config.release}</Body>
  </Page>;
}
