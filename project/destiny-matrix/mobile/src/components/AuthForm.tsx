import { useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../state/AppState';
import { isSession, type Session } from '../native/contracts';
import { authHref, safeAuthReturn } from '../native/authReturn';
import { isRecord } from '../native/http';
import { Action, Body, Card, Field, Heading, Page } from './ui';
import { AppLink } from './AppLink';
import { CardFan } from './BrandArt';
import { GoogleSignIn } from './GoogleSignIn';

export function AuthForm({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const { t, api, authenticate } = useApp();
  const params = useLocalSearchParams<{ token?: string; returnTo?: string }>();
  const returnTo = safeAuthReturn(params.returnTo);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const run = async (operation: () => Promise<void>) => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true);
    try { await operation(); } finally { submitting.current = false; setBusy(false); }
  };
  const signedIn = async (session: Session) => {
    await authenticate(session);
    setPassword('');
    router.dismissTo(session.deletion ? '/settings' : returnTo);
  };
  const title = mode === 'login' ? t('Войти', 'Sign in') : mode === 'register' ? t('Создать аккаунт', 'Create account') : t('Восстановить пароль', 'Reset password');
  return <Page><CardFan compact cards={[2, 1, 17]} /><Heading>{title}</Heading><Card>
    {(mode === 'login' || mode === 'register') && <>
      <GoogleSignIn disabled={busy} run={run} onAuthenticated={signedIn} forgotHref={authHref('forgot', returnTo)} />
      <Body muted>{mode === 'register'
        ? t('Создавая аккаунт, вы принимаете условия сервиса и политику конфиденциальности.', 'By creating an account, you accept the terms and privacy policy.')
        : t('Продолжая с Google, вы принимаете условия сервиса и политику конфиденциальности.', 'By continuing with Google, you accept the terms and privacy policy.')}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 }}><AppLink href="/terms" label={t('Условия', 'Terms')} /><AppLink href="/privacy" label={t('Конфиденциальность', 'Privacy')} /></View>
      <Body muted>{t('Или войдите по почте и паролю', 'Or use your email and password')}</Body>
    </>}
    {done ? <Body>{t('Если адрес зарегистрирован, письмо со ссылкой отправлено. Проверьте также папку «Спам».', 'If the address is registered, a reset link has been sent. Check your spam folder too.')}</Body> : <>
      {mode !== 'reset' && <Field label={t('Почта', 'Email')} testID="auth-email" value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />}
      {mode !== 'forgot' && <Field label={t('Пароль', 'Password')} testID="auth-password" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />}
      {mode === 'reset' && !params.token ? <Body>{t('Откройте ссылку из письма для восстановления пароля.', 'Open the password reset link from your email.')}</Body> :
        <Action testID="auth-submit" disabled={busy} title={mode === 'forgot' ? t('Отправить письмо', 'Send email') : title} onPress={() => run(async () => {
          if (mode === 'forgot') { await api('/auth/reset/request', isRecord, { method: 'POST', anonymous: true, body: { email } }); setDone(true); return; }
          const session = await api(mode === 'reset' ? '/mobile/auth/reset/apply' : `/mobile/auth/${mode}`, isSession,
            { method: 'POST', anonymous: true, body: mode === 'reset' ? { token: params.token, password } : { email, password } });
          await signedIn(session);
        })} />}
    </>}
    {mode === 'login' ? <><AppLink href={authHref('register', returnTo)} label={t('Создать аккаунт', 'Create account')} /><AppLink href={authHref('forgot', returnTo)} label={t('Забыли пароль?', 'Forgot password?')} /></> : <AppLink href={authHref('login', returnTo)} label={t('Войти', 'Sign in')} />}
  </Card></Page>;
}
