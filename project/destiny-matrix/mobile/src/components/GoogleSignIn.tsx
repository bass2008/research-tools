import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { GoogleSignInButton } from 'react-native-nitro-google-signin';
import { useApp } from '../state/AppState';
import { usePalette } from '../state/Design';
import { ApiError, record } from '../native/http';
import { isSession, type Session } from '../native/contracts';
import { isGoogleChallenge, NativeGoogleError, requestGoogleCredential } from '../native/googleSignIn';
import { Action, Body, Field, styles } from './ui';
import { AppLink } from './AppLink';

interface Proof { credential: string; challenge: string; expiresAt: number }
export interface GoogleSignInProps {
  disabled: boolean;
  run: (operation: () => Promise<void>) => Promise<void>;
  onAuthenticated: (session: Session) => Promise<void>;
  forgotHref?: string;
}

export function GoogleSignIn({ disabled, run, onAuthenticated, forgotHref }: GoogleSignInProps) {
  const { api, t } = useApp(); const palette = usePalette();
  const [error, setError] = useState(''), [password, setPassword] = useState('');
  const [linkUntil, setLinkUntil] = useState<number | null>(null);
  const proof = useRef<Proof | null>(null), mounted = useRef(false), generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const expiredText = t('Время подтверждения истекло. Нажмите Google ещё раз.', 'Confirmation expired. Tap Google again.');
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; proof.current = null; abort.current?.abort(); };
  }, []);
  useEffect(() => {
    if (linkUntil === null) return;
    const timer = setTimeout(() => {
      generation.current++; proof.current = null; abort.current?.abort();
      setLinkUntil(null); setPassword(''); setError(expiredText);
    }, Math.max(0, linkUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [linkUntil, expiredText]);
  const clear = () => {
    generation.current++; proof.current = null; abort.current?.abort(); abort.current = null;
    if (mounted.current) { setLinkUntil(null); setPassword(''); }
    return generation.current;
  };
  const live = (attempt: number) => mounted.current && generation.current === attempt;
  const message = (cause: unknown) => cause instanceof ApiError ? cause.message : cause instanceof NativeGoogleError && cause.reason === 'unavailable'
    ? t('Для входа Google нужны сервисы Google Play. Можно войти по почте и паролю.', 'Google Sign-In needs Google Play services. You can use email and password instead.')
    : t('Не удалось войти через Google. Повторите или войдите по почте и паролю.', 'Google Sign-In could not be completed. Try again or use email and password.');
  const exchange = async (current: Proof, attempt: number, currentPassword?: string) => {
    if (current.expiresAt <= Date.now()) { clear(); setError(expiredText); return; }
    try {
      const session = await api('/mobile/auth/google', isSession, { method: 'POST', anonymous: true, signal: abort.current?.signal,
        body: { credential: current.credential, challenge: current.challenge,
          ...(currentPassword === undefined ? {} : { current_password: currentPassword }) } });
      if (!live(attempt)) return;
      clear();
      try { await onAuthenticated(session); }
      catch (cause) { if (mounted.current) setError(message(cause)); }
    } catch (cause) {
      if (!live(attempt)) return;
      const linking = cause instanceof ApiError && cause.status === 409 && record(cause.data) && cause.data.code === 'google_link_required';
      const wrongPassword = currentPassword !== undefined && cause instanceof ApiError && cause.status === 401;
      if ((linking || wrongPassword) && current.expiresAt > Date.now()) {
        proof.current = current; setLinkUntil(current.expiresAt); setPassword('');
        setError(linking ? '' : message(cause));
      } else { clear(); setError(message(cause)); }
    }
  };
  const start = async () => {
    if (disabled) return;
    await run(async () => {
      const attempt = clear(); setError(''); abort.current = new AbortController();
      // Start the local lifetime before the request: it never extends the server's five minutes.
      const expiresAt = Date.now() + 300_000;
      try {
        const challenge = await api('/mobile/auth/google/challenge', isGoogleChallenge, {
          method: 'POST', anonymous: true, body: {}, signal: abort.current.signal,
        });
        if (!live(attempt)) return;
        const credential = await requestGoogleCredential(challenge);
        if (!live(attempt) || credential === null) return;
        await exchange({ credential, challenge: challenge.challenge, expiresAt }, attempt);
      } catch (cause) { if (live(attempt)) { clear(); setError(message(cause)); } }
    });
  };
  const confirm = async () => {
    if (disabled || !password) return;
    await run(async () => {
      const current = proof.current;
      if (!current || current.expiresAt <= Date.now()) { clear(); setError(expiredText); return; }
      setError(''); abort.current = new AbortController();
      await exchange(current, generation.current, password);
    });
  };
  return <View style={{ gap: 12 }}>
    <GoogleSignInButton testID="google-sign-in" size="standard" colorScheme="light" signInBehavior="none"
      accessibilityRole="button" accessibilityLabel={t('Войти через Google', 'Sign in with Google')}
      accessibilityState={{ disabled }} disabled={disabled} onPress={start}
      style={{ width: '100%', maxWidth: 230, height: 48, alignSelf: 'center' }} />
    {linkUntil !== null && <View testID="google-link-confirmation" style={{ gap: 12 }}>
      <Body>{t('Аккаунт с этой почтой уже существует. Подтвердите его пароль, чтобы подключить Google.', 'An account with this email already exists. Confirm its password to connect Google.')}</Body>
      <Field label={t('Пароль существующего аккаунта', 'Existing account password')} testID="google-link-password"
        value={password} onChangeText={setPassword} secureTextEntry editable={!disabled} maxLength={200}
        autoCapitalize="none" autoCorrect={false} autoComplete="current-password" />
      <Action testID="google-link-submit" title={t('Подтвердить и войти', 'Confirm and sign in')} disabled={disabled || !password} onPress={confirm} />
      {forgotHref && <AppLink testID="google-link-forgot" href={forgotHref} label={t('Восстановить пароль', 'Reset password')} />}
      <Action testID="google-link-cancel" secondary title={t('Отмена', 'Cancel')} disabled={disabled} onPress={() => { clear(); setError(''); }} />
    </View>}
    {!!error && <Text accessibilityRole="alert" style={[styles.error, { color: palette.error }]}>{error}</Text>}
  </View>;
}
