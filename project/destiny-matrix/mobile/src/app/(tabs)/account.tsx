import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { TabHeading } from '../../components/TabHeading';
import { useApp } from '../../state/AppState';
import { useRemote } from '../../state/useRemote';
import { isNotifications, isReading, isReadingList, isUser } from '../../native/contracts';
import { isEmpty, isRecord } from '../../native/http';
import { AppLink, useNavigate } from '../../components/AppLink';
import { Action, Body, Card, Field, Heading, Page, RemoteStatus, Segments, colors, fonts, styles } from '../../components/ui';
import { Icon } from '../../components/BrandArt';
import { ArcanumImage } from '../../components/ArcanumImage';
import { MatrixMap } from '../../components/MatrixMap';
import { computePair, pointsOf } from '@/lib/pair/engine';
import { forLocale as matrixForLocale } from '@/lib/matrix';
import type { ReadingItem } from '@/lib/api';

function ReadingRow({ row, reload }: { row: ReadingItem; reload: () => void }) {
  const { t, api, locale } = useApp();
  const navigate = useNavigate();
  const [rename, setRename] = useState(false);
  const [title, setTitle] = useState(row.title ?? '');
  let points: Record<string, number> | null = null;
  try {
    if (row.product === 'personal' && row.birth) {
      points = pointsOf(matrixForLocale(locale).calculate(row.birth, row.sex === 'm' ? 'm' : 'f'));
    } else if (row.product === 'pair' && isRecord(row.inputs.a) && isRecord(row.inputs.b)
      && typeof row.inputs.a.birth === 'string' && typeof row.inputs.b.birth === 'string') {
      points = computePair(row.inputs.a.birth, row.inputs.b.birth, locale).p;
    }
  } catch { /* Invalid historical dates still retain their reading link. */ }
  return <Card><Pressable accessibilityRole="link" onPress={() => { void navigate(row.product === 'personal' ? `/matrices/${row.id}` : `/readings/${row.id}`).catch(e => Alert.alert(String(e.message))); }}
    style={({ pressed }) => ({ flexDirection: 'row', gap: 14, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
    {points ? <View pointerEvents="none" style={{ width: 96 }}>
      <MatrixMap points={points} miniature variant={row.product === 'pair' ? 'pair' : undefined} />
    </View> : <View style={{ padding: 14 }}>
      <Icon name={row.product === 'pair' ? 'pair' : 'matrix'} size={40} color={colors.gold} />
    </View>}
    <View style={{ flex: 1, gap: 4 }}><Text style={styles.eyebrow}>{row.product === 'pair' ? t('Совместимость', 'Compatibility') : t('Личная матрица', 'Personal matrix')}</Text><Text style={{ fontFamily: fonts.display, fontSize: 23, lineHeight: 29, paddingBottom: 2, color: colors.ink }}>{row.title || row.birth || (typeof row.inputs.a === 'object' ? t('Пара', 'Pair') : t('Матрица', 'Matrix'))}</Text></View><Icon name="arrow" size={17} color={colors.gold} />
  </Pressable>
    {rename && <><Field label={t('Подпись', 'Label')} value={title} onChangeText={setTitle} maxLength={200} /><Action secondary title={t('Сохранить', 'Save')} onPress={async () => {
      await api(`/readings/${row.id}`, isReading, { method: 'PATCH', body: { title } }); setRename(false); reload();
    }} /></>}
    <View style={[styles.row, { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 2 }]}>
      <View style={{ flexShrink: 1 }}><Body muted>{row.access === 'locked' ? t('Бесплатная часть', 'Free preview') : row.access_until ? `${t('Доступ до', 'Available until')} ${new Date(row.access_until).toLocaleDateString()}` : t('Доступ открыт', 'Access unlocked')}</Body></View>
      <Pressable accessibilityRole="button" onPress={() => setRename(!rename)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}><Text style={styles.muted}>{rename ? t('Отмена', 'Cancel') : t('Переименовать', 'Rename')}</Text></Pressable>
      {row.can_delete && <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }} onPress={() => {
        Alert.alert(t('Убрать разбор из кабинета?', 'Remove this reading?'), '', [{ text: t('Отмена', 'Cancel'), style: 'cancel' }, {
          text: t('Удалить', 'Remove'), style: 'destructive', onPress: () => { void api(`/readings/${row.id}`, isEmpty, { method: 'DELETE' }).then(reload).catch(e => Alert.alert(t('Не удалось удалить', 'Unable to remove'), String(e.message))); },
        }]);
      }}><Text style={[styles.muted, { color: colors.error }]}>{t('Удалить', 'Remove')}</Text></Pressable>}</View>
  </Card>;
}
export default function Account() {
  const { session, t, api } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'readings' | 'notifications'>('readings');
  const me = useRemote(session && !session.deletion ? '/auth/me' : null, isUser, { private: true });
  const readings = useRemote(session && !session.deletion ? '/readings' : null, isReadingList, { private: true });
  const notices = useRemote(session && !session.deletion && tab === 'notifications' ? '/notifications?page_size=50' : null, isNotifications, { private: true });
  return <Page tab>
    <TabHeading title={t('Кабинет', 'Account')} settings />
    {!session ? <Card style={{ padding: 22, gap: 18 }}><Heading>{t('Ваши разборы — рядом', 'Your readings, together')}</Heading><Body>{t('Войдите, чтобы открыть сохранённые даты и покупки.', 'Sign in to open saved dates and purchases.')}</Body><Action title={t('Войти', 'Sign in')} onPress={() => navigate('/login')} /><View style={{ alignItems: 'center' }}><AppLink href="/register" label={t('Создать аккаунт', 'Create account')} /></View></Card> : session.deletion ?
      <Card><Body>{t('Аккаунт ожидает удаления.', 'Account deletion is pending.')}</Body><AppLink href="/settings" label={t('Восстановить аккаунт', 'Restore account')} /></Card> : <>
      <View testID="account-profile" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 8 }}><View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.gold }}>{session.user.email.charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Body>{me.data?.user.email ?? session.user.email}</Body><AppLink href="/settings" label={t('Настройки аккаунта', 'Account settings')} /></View></View>
      <Segments value={tab} onChange={setTab} options={[{ value: 'readings', label: t('Мои разборы', 'My readings') }, { value: 'notifications', label: t('Уведомления', 'Notifications') }]} />
      {tab === 'readings' ? <><RemoteStatus {...readings} />
        {readings.data?.items.filter(row => ['personal', 'pair'].includes(row.product)).map(row => <ReadingRow key={row.id} row={row} reload={readings.reload} />)}
        {readings.data?.items.length === 0 && <Card><View style={{ alignItems: 'center', paddingVertical: 16 }}><View style={{ transform: [{ rotate: '-5deg' }] }}><ArcanumImage n={1} width={88} decorative /></View></View>
          <Heading>{t('Место для ваших разборов', 'A home for your readings')}</Heading>
          <Body muted>{t('Сохраните свою матрицу после расчёта. Она появится здесь, чтобы вы могли вернуться к ней в любое время.', 'Save your chart after calculating it. It will appear here, ready whenever you want to return.')}</Body>
          <Action title={t('Рассчитать матрицу', 'Calculate my chart')} onPress={() => navigate('/calculate')} />
        </Card>}
      </> : <><RemoteStatus {...notices} />
        {!!notices.data?.unread_count && <Action secondary title={t('Прочитать все', 'Mark all as read')} onPress={async () => { await api('/notifications/read-all', isRecord, { method: 'POST', body: { through_id: notices.data?.through_id } }); notices.reload(); }} />}
        {notices.data?.items.map(n => <Card key={n.delivery_id}><Heading>{n.title}</Heading><Body>{n.text}</Body>
          {!!n.action.href && <AppLink href={n.action.href} label={n.action.label} />}
          {!n.read_at && <Action secondary title={t('Прочитано', 'Mark as read')} onPress={async () => { await api(`/notifications/${n.delivery_id}/read`, isRecord, { method: 'POST', body: {} }); notices.reload(); }} />}
        </Card>)}
        {notices.data?.items.length === 0 && <Card><View style={{ alignSelf: 'flex-start', padding: 12, borderRadius: 30, backgroundColor: colors.card2 }}><Icon name="book" color={colors.gold} size={28} /></View>
          <Heading>{t('Новых уведомлений нет', 'No notifications yet')}</Heading><Body muted>{t('Сообщения о ваших разборах и аккаунте будут здесь.', 'Updates about your readings and account will appear here.')}</Body>
        </Card>}
      </>}
    </>}
  </Page>;
}
