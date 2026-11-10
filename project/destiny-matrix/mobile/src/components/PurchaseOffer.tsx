import { Text, View } from 'react-native';
import { useApp } from '../state/AppState';
import { useDesign } from '../state/Design';
import type { ProductId } from '../state/Billing';
import { Action, Body, Card, Heading, fonts, styles } from './ui';
import { Kicker } from './DesignElements';

export function OfferIntro() {
  const { design } = useDesign(); const { t } = useApp();
  return <View testID="design-subscription" style={{ gap: 12 }}>
    <><Kicker>{t('Вся история, глава за главой', 'Your whole story, chapter by chapter')}</Kicker><Heading>{t('Читать глубже.', 'Read more deeply.')}</Heading><View style={{ height: 1, backgroundColor: design.gold, width: 52 }} /></>

  </View>;
}

export function PurchaseOffer({ sku, price, busy, requiresSignIn = false, onPress }: { sku: ProductId; price: string; busy: boolean; requiresSignIn?: boolean; onPress: () => Promise<void> }) {
  const { design } = useDesign(); const { t } = useApp(); const subscription = sku === 'month';
  const title = subscription ? t('Все разборы на 3 месяца', 'All readings for 3 months') : sku === 'pair' ? t('Полный разбор этой пары', 'Full reading for this couple') : t('Полный разбор этой даты', 'Full reading for this date');
  const label = t('Подписка · автоматические разборы', 'Subscription · automatic readings');
  const personal = t('Личные разборы', 'Personal readings'), couple = t('Разборы пары', 'Couple readings');
  const anyDates = t('Для любых дат', 'For any dates'), saved = t('Сохранение и PDF', 'Saved readings and PDF');
  const priceBlock = <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8, rowGap: 2 }}>
    <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 40, color: '#243632', fontVariant: ['tabular-nums'] }}>{price}</Text>
    <Body muted>{subscription ? t('/ 3 месяца', '/ 3 months') : t('один раз', 'once')}</Body>
  </View>;
  const terms = <Body muted>{subscription ? t(`${price} каждые 3 месяца с автопродлением. Отмена в Google Play; доступ до конца оплаченного срока.`, `Renews automatically at ${price} every 3 months. Cancel in Google Play; access lasts until the paid period ends.`) : t('Разовая покупка, доступ без ограничения срока.', 'One-time purchase with lifetime access.')}</Body>;
  const actionLabel = requiresSignIn ? subscription ? t('Войти для подписки', 'Sign in to subscribe') : t('Войти для покупки', 'Sign in to purchase')
    : subscription ? t('Оформить подписку', 'Subscribe') : t('Купить разбор', 'Buy this reading');
  const action = <Action testID={`${requiresSignIn ? 'sign-in' : 'buy'}-${sku}`} tone={subscription ? 'teal' : 'gold'} title={`${actionLabel} · ${price}`} disabled={busy} onPress={onPress} />;
  const rule = <View style={{ height: 1, backgroundColor: design.border }} />;
  const detailStyle = { ...styles.text, fontSize: 13, lineHeight: 21, color: '#243632' };

  if (!subscription) return <Card style={{ gap: 14 }}>
    <Kicker>{t('Один разбор · навсегда', 'One reading · yours to keep')}</Kicker>
    <Heading>{title}</Heading>
    <Body>{t('Все разделы этого разбора', 'Every section of this reading')}</Body>
    <Body muted>{t('PDF и доступ в личном кабинете', 'PDF and access in your account')}</Body>
    {priceBlock}{terms}{action}
  </Card>;

  return <Card style={{ marginTop: 20, borderTopWidth: 2, borderTopColor: design.border, gap: 16, backgroundColor: design.background }}>
    <Kicker>{label}</Kicker><Heading>{title}</Heading>
    <View style={{ gap: 12 }}>
      {[personal, couple].map((text, index) => <View key={text} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Text accessible={false} style={{ fontFamily: fonts.display, fontSize: 23, lineHeight: 28, color: '#8c6c29', minWidth: 38 }}>{`0${index + 1}`}</Text>
        <View style={{ flex: 1, gap: 2 }}><Text style={[detailStyle, { fontFamily: fonts.bold }]}>{text}</Text><Body muted>{anyDates}</Body></View>
      </View>)}
      <Body muted>{saved}</Body>
    </View>
    {rule}{priceBlock}{terms}{action}
  </Card>;

}
