import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { forLocale as matrixForLocale } from '@/lib/matrix';
import { useApp } from '../state/AppState';
import { useBilling, type ProductId } from '../state/Billing';
import { Action, Body, Card, Page, RemoteStatus, colors, styles } from '../components/ui';
import { AppLink } from '../components/AppLink';
import { config } from '../native/config';
import { useProductAccess } from '../state/useProductAccess';
import { useRemote } from '../state/useRemote';
import { isReading } from '../native/contracts';
import { Text, View } from 'react-native';
import { Icon } from '../components/BrandArt';
import { OfferIntro, PurchaseOffer } from '../components/PurchaseOffer';
import { PurchaseComplete, PurchaseNotice } from '../components/PurchaseFeedback';
import { record } from '../native/http';
import { Entrance } from '../components/Entrance';
import { authHref } from '../native/authReturn';
import { chapterHref } from '../native/personalReading';
import { PurchaseContents } from '../components/PurchaseContents';

type CheckoutParams = { id?: string; product?: string; birth?: string; sex?: string; a?: string; b?: string; chapter?: string };

export default function Purchase() {
  const { id, product = 'single', birth, sex, a, b, chapter } = useLocalSearchParams<CheckoutParams>();
  return <Checkout key={JSON.stringify([product, id, birth, sex, a, b, chapter])} id={id} product={product} birth={birth} sex={sex} a={a} b={b} chapter={chapter} />;
}

function Checkout({ id, product, birth, sex, a, b, chapter }: CheckoutParams) {
  const { t, locale, session, invalidateAccess } = useApp(); const billing = useBilling();
  const returnTo = `/purchase?${new URLSearchParams(Object.entries({ product, id, birth, sex, a, b, chapter }).filter((entry): entry is [string, string] => entry[1] !== undefined))}`;
  const rights = useProductAccess(product === 'pair' ? 'pair' : 'personal');
  const validId = typeof id === 'string' && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
  // A general subscription entry has no reading target. Only offer a one-time
  // purchase after applying the same date validation as the calculators.
  const oneTimeTarget = useMemo(() => {
    if (product !== 'single' && product !== 'pair' && product !== 'month') return null;
    if (id !== undefined) return validId ? { reading_id: Number(id) } : null;
    const matrix = matrixForLocale(locale);
    try {
      if (product === 'pair') {
        if (typeof a !== 'string' || typeof b !== 'string') return null;
        return { inputs: { a: { birth: matrix.calculate(a).birth }, b: { birth: matrix.calculate(b).birth } } };
      }
      if (typeof birth !== 'string' || sex !== undefined && sex !== 'f' && sex !== 'm') return null;
      const personal = matrix.calculate(birth, sex ?? 'f');
      return { inputs: { birth: personal.birth, sex: personal.sex } };
    } catch { return null; }
  }, [product, id, validId, locale, a, b, birth, sex]);
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState<{ previousOrderId: string | null; sku: ProductId } | null>(null);
  const [restoreState, setRestoreState] = useState<'idle' | 'running' | 'done'>('idle');
  const [issue, setIssue] = useState<{ restore: boolean; message: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const purchaseLock = useRef(false);
  // Unsaved inputs and subscriptions need an attempt made on this exact screen.
  // The provider's previous receipt can remain visible while the next order starts.
  const currentAttempt = attempt && billing.receipt?.order_id !== attempt.previousOrderId &&
    (attempt.sku === 'month' ? billing.receipt?.reading_id === null : billing.receipt?.reading_id !== null);
  const receipt = session && !session.deletion && billing.receipt && (id && billing.receipt.reading_id === Number(id) ||
    currentAttempt && (!id || billing.receipt.reading_id === null)) ? billing.receipt : null;
  // A pending one-time purchase already has an owner-bound reading ID. Rechecking
  // that reading also lets Restore finish this screen without inventing a receipt.
  const targetId = validId ? Number(id) : receipt?.reading_id;
  const reading = useRemote(session && !session.deletion && targetId ? `/readings/${targetId}` : null, isReading, { private: true, cache: false });
  const checking = rights.loading || (!!targetId && reading.loading);
  const wrongReading = id !== undefined && !validId || !!reading.data && reading.data.product !== (product === 'pair' ? 'pair' : 'personal');
  const accessError = rights.error || reading.error || (wrongReading ? t('Разбор не найден.', 'Reading not found.') : undefined);
  const readingOpen = !!reading.data && reading.data.access !== 'locked';
  const receiptAccess = !!receipt?.access && (!receipt.expires_at || Date.parse(receipt.expires_at) > now);
  useEffect(() => {
    const expiry = receipt?.expires_at ? Date.parse(receipt.expires_at) : 0;
    if (!(expiry > now)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(Math.max(0, expiry - Date.now()), 2147483647));
    return () => clearTimeout(timer);
  }, [receipt?.expires_at, now]);
  const waitingForPayment = receipt?.state === 'pending';
  const busy = billing.busy || submitting || restoreState === 'running';
  const handlePurchase = useCallback(async (sku: ProductId) => {
    if (purchaseLock.current || busy || checking || accessError || readingOpen || rights.unlimited || receiptAccess || waitingForPayment || !billing.canPurchase || session?.deletion) return;
    if (sku !== 'month' && (!oneTimeTarget || sku !== (product === 'pair' ? 'pair' : 'single'))) return;
    // Browsing the real offer is public. Authentication only starts after a
    // deliberate choice, and returning here never creates or pays for an order.
    if (!session) { router.push(authHref('login', returnTo) as Href); return; }
    purchaseLock.current = true; setSubmitting(true);
    setIssue(null); setRestoreState('idle');
    setAttempt({ previousOrderId: billing.receipt?.order_id ?? null, sku });
    try { await billing.purchase(sku, sku === 'month' ? {} : oneTimeTarget!); }
    catch (error) { setIssue({ restore: false, message: error instanceof Error ? error.message : t('Не удалось завершить покупку.', 'The purchase could not be completed.') }); }
    finally { purchaseLock.current = false; setSubmitting(false); }
  }, [busy, checking, accessError, readingOpen, rights.unlimited, receiptAccess, waitingForPayment, product, oneTimeTarget, billing, session, returnTo, t]);
  const handleRestore = useCallback(async () => {
    if (purchaseLock.current || busy || !session || session.deletion) return;
    purchaseLock.current = true; setIssue(null); setRestoreState('running');
    try { await billing.restore(); reading.reload(); setRestoreState('done'); }
    catch (error) { setRestoreState('idle'); setIssue({ restore: true, message: error instanceof Error ? error.message : t('Не удалось проверить покупки.', 'Purchases could not be checked.') }); }
    finally { purchaseLock.current = false; }
  }, [busy, billing, reading, session, t]);
  const buyReading = () => handlePurchase(product === 'pair' ? 'pair' : 'single');
  const buySubscription = () => handlePurchase('month');

  const confirmed = session && !session.deletion && !wrongReading && (receiptAccess || !checking && !accessError && (rights.unlimited || readingOpen));
  if (confirmed) {
    const subscription = receiptAccess ? receipt!.reading_id === null : rights.unlimited && billing.status?.subscriptions.some(item => item.access);
    const unlimited = subscription || rights.unlimited && !receiptAccess;
    const until = receiptAccess ? receipt!.expires_at : unlimited ? rights.until : reading.data?.access_until;
    const dateLabel = (value: string) => new Date(value).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const readableDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? dateLabel(value) : null;
    const inputs = reading.data?.inputs;
    const context = !oneTimeTarget && !targetId ? null : product === 'pair' ? [a ?? (record(inputs?.a) ? inputs.a.birth : undefined), b ?? (record(inputs?.b) ? inputs.b.birth : undefined)].map(readableDate).filter(Boolean).join('\n')
      : readableDate(birth ?? reading.data?.birth ?? inputs?.birth);
    const openedId = receiptAccess && receipt!.reading_id ? receipt!.reading_id : targetId;
    const href = chapter && product !== 'pair' && (openedId || birth)
      ? chapterHref(openedId ? { id: String(openedId) } : { birth, sex }, chapter)
      : openedId ? `/reading/${openedId}` : oneTimeTarget && product === 'pair' && a && b ? `/compatibility?${new URLSearchParams({ a, b })}`
      : oneTimeTarget && birth ? `/report?${new URLSearchParams({ birth, sex: sex === 'm' ? 'm' : 'f' })}` : '/account';
    const renewing = receiptAccess ? receipt!.auto_renewing : billing.status?.subscriptions.find(item => item.access)?.auto_renewing;
    return <Page key="complete"><Entrance><PurchaseComplete
      cards={subscription ? [17, 21, 1] : product === 'pair' ? [2, 6, 14] : [1, 9, 17]}
      eyebrow={t('Можно переходить к чтению', 'Ready to read')}
      title={subscription ? t('Подписка активна', 'Your subscription is active') : unlimited ? t('Разборы уже доступны', 'Your readings are available')
        : product === 'pair' ? t('Разбор пары открыт', 'Your couple reading is unlocked') : t('Разбор открыт', 'Your reading is unlocked')}
      description={subscription ? t('Личные матрицы и совместимость для любых дат — теперь в полном доступе.', 'Full personal and couple readings are now available for any dates.')
        : product === 'pair' ? t('Все сферы совместимости и разбор чакр пары доступны для чтения.', 'Every area of compatibility and your couple chakra reading are ready to explore.')
          : t('Все разделы вашей личной матрицы доступны для чтения.', 'Every section of your personal reading is ready to explore.')}
      context={context || undefined}
      facts={[unlimited ? t('Создавайте и читайте новые разборы', 'Create and read more readings') : t('Возвращайтесь к разбору в кабинете', 'Return to this reading from your account'),
        openedId ? t('PDF можно открыть и сохранить из разбора', 'Open and save the PDF from your reading')
          : t('Сохраните разбор в кабинете, чтобы открыть PDF', 'Save the reading to your account to open its PDF'),
        until ? t(`Доступ до ${dateLabel(until)}`, `Access until ${dateLabel(until)}`) : subscription ? t('Срок доступа указан в кабинете', 'View your access period in your account') : t('Доступ без ограничения срока', 'Access with no expiry')]}
      note={subscription ? renewing === true ? t('Автопродление включено. Управление подпиской — в Google Play.', 'Auto-renewal is on. Manage your subscription in Google Play.')
        : renewing === false ? t('Автопродление отключено. Доступ сохраняется до конца оплаченного срока.', 'Auto-renewal is off. Access lasts until the paid period ends.') : undefined : undefined}
      action={href === '/account' ? t('Мои разборы', 'My readings') : t('Открыть разбор', 'Open reading')}
      onRead={() => router.dismissTo(href as Href)} /></Entrance>
      {config.local && billing.status?.provider === 'mock' && <Body muted>{t('Тестовый режим · без списаний', 'Test mode · no charge')}</Body>}
    </Page>;
  }
  if (session && !session.deletion && (waitingForPayment || restoreState === 'running' || busy && attempt)) {
    const restoring = restoreState === 'running';
    return <Page key="waiting"><PurchaseNotice waiting title={restoring ? t('Проверяем покупки', 'Checking purchases') : waitingForPayment ? t('Ожидаем подтверждение оплаты', 'Payment confirmation pending') : t('Завершаем покупку', 'Completing your purchase')}
      description={restoring ? t('Проверяем прежние покупки и доступ к разборам в этом аккаунте.', 'Checking previous purchases and reading access for this account.')
        : waitingForPayment ? t('Покупка ожидает подтверждения. Полный доступ откроется после завершения оплаты.', 'The purchase is awaiting confirmation. Full access will unlock once payment is complete.')
          : t('Подтверждаем покупку и открываем полный доступ.', 'Confirming your purchase and unlocking full access.')}
      detail={issue?.message || billing.error || t('Повторно оплачивать не нужно.', 'There is no need to pay again.')}>
      {waitingForPayment && !restoring && <Action secondary testID="restore-purchases" title={t('Проверить покупку', 'Check purchase')} disabled={busy} onPress={handleRestore} />}
    </PurchaseNotice><AppLink href="/account" label={t('Перейти в кабинет', 'Go to account')} /></Page>;
  }
  if (session && !session.deletion && restoreState === 'done') return <Page key="restored"><PurchaseNotice title={t('Покупки проверены', 'Purchases checked')}
    description={t('Откройте кабинет, чтобы увидеть доступные разборы. Если покупка была для другой даты или пары, ищите её там.', 'Open your account to see available readings, including purchases for a different date or couple.')}>
    <Action testID="restore-open-account" title={t('Мои разборы', 'My readings')} onPress={() => router.replace('/account')} />
    <Action secondary title={t('Вернуться к выбору', 'Back to options')} onPress={() => setRestoreState('idle')} />
  </PurchaseNotice></Page>;
  const paymentIssue = issue?.message || billing.error;
  const targetBirth = birth ?? reading.data?.birth ?? reading.data?.inputs?.birth;
  const targetSex = sex ?? reading.data?.sex ?? reading.data?.inputs?.sex;
  return <Page key="offers">
    {product !== 'pair' && typeof targetBirth === 'string'
      ? <PurchaseContents birth={targetBirth} sex={typeof targetSex === 'string' ? targetSex : undefined} />
      : <OfferIntro />}
    {!billing.canPurchase || session?.deletion ? <Card><Body>{t('Доступны бесплатные расчёты и ранее приобретённые разборы.', 'Free calculations and previously purchased readings are available.')}</Body><AppLink href="/account" label={t('Открыть кабинет', 'Open account')} />
      {session && !session.deletion && <><Action secondary testID="restore-purchases" title={t('Восстановить покупки', 'Restore purchases')} disabled={busy} onPress={handleRestore} />
        {issue && <Text accessibilityRole="alert" style={styles.error}>{issue.message}</Text>}</>}
    </Card> : <>
      {config.local && billing.status?.provider === 'mock' && <Body muted>{t('Тестовая покупка · деньги не списываются', 'Test purchase · no charge')}</Body>}
      <RemoteStatus loading={checking} error={accessError} reload={() => { reading.reload(); invalidateAccess(); }} />
      {!checking && !accessError && !oneTimeTarget && product !== 'month' && <Card>
        <Body>{t('Для разовой покупки сначала выберите корректные даты и откройте расчёт.', 'For a one-time purchase, first choose valid dates and open the calculation.')}</Body>
        <AppLink href={product === 'pair' ? '/compatibility' : '/calculate'} label={t('Перейти к расчёту', 'Open calculator')} />
      </Card>}
      {session && paymentIssue ? <PurchaseNotice error title={issue?.restore ? t('Покупки не удалось проверить', 'Purchases could not be checked') : t('Покупка не завершена', 'Purchase not completed')}
        description={t('Если вы уже оплатили покупку, проверьте её перед новой оплатой.', 'If you have already paid, check the purchase before paying again.')} detail={paymentIssue}>
        <Action secondary testID="restore-purchases" title={issue?.restore ? t('Повторить проверку', 'Check again') : t('Проверить покупки', 'Check purchases')} disabled={busy} onPress={handleRestore} />
      </PurchaseNotice> : receipt && !receiptAccess && <PurchaseNotice title={receipt.state === 'canceled' ? t('Покупка отменена', 'Purchase canceled')
        : receipt.state === 'expired' ? t('Срок доступа завершён', 'Access has expired') : t('Доступ не подтверждён', 'Access is not confirmed')}
        description={receipt.state === 'canceled' ? t('Можно вернуться к выбору, когда будете готовы.', 'You can choose an option whenever you are ready.')
          : t('Проверьте прежние покупки или выберите подходящий доступ ниже.', 'Check previous purchases or choose an access option below.')} />}
      {!checking && !accessError && ((oneTimeTarget ? product === 'month' ? ['month', 'single'] : [product === 'pair' ? 'pair' : 'single', 'month'] : ['month']) as ProductId[]).map(sku => {
        const price = billing.price(sku); return price ? <PurchaseOffer key={sku} sku={sku} price={price} busy={busy} requiresSignIn={!session} onPress={sku === 'month' ? buySubscription : buyReading} /> : null;
      })}
      {!session && <Body muted>{t('Один аккаунт для сайта и приложения. После входа вы вернётесь сюда и подтвердите покупку отдельно.', 'One account for the website and app. After signing in, you will return here and confirm your purchase separately.')}</Body>}
      {session && !paymentIssue && <Action secondary testID="restore-purchases" title={t('Восстановить покупки', 'Restore purchases')} disabled={busy} onPress={handleRestore} />}
      {billing.status?.provider !== 'mock' && <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Icon name="lock" color={colors.gold} size={15} /><View style={{ flex: 1 }}><Body muted>{t('Оплата и управление подпиской — в Google Play.', 'Payment and subscription management through Google Play.')}</Body></View></View>}
      <View style={styles.row}><AppLink href="/terms" label={t('Условия', 'Terms')} /><AppLink href="/privacy" label={t('Конфиденциальность', 'Privacy')} /><AppLink href="/refund" label={t('Возврат', 'Refund')} /></View>
    </>}
  </Page>;
}
