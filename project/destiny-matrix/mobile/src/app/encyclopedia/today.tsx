import { View } from 'react-native';
import { useMyReading } from '../../state/useMyReading';
import { useApp } from '../../state/AppState';
import { dailyContent } from '../../daily/content';
import { dailyRelatedSection } from '../../daily/relatedSection';
import { chapterTitle } from '../../native/personalReading';
import { useDailySelection } from '../../daily/DailyProvider';
import { DailyTheme } from '../../components/DailyTheme';
import { AppLink } from '../../components/AppLink';
import { Body, Card, Heading, Page } from '../../components/ui';

export default function Today() {
  const { locale, t } = useApp(), day = useDailySelection();
  const content = dailyContent(locale, day.arcanum);
  const { me, sections } = useMyReading();
  const related = dailyRelatedSection(locale, day.arcanum);
  const chapter = sections?.find(section => section.key === related.key && !section.locked);
  return <Page>
    <View testID="daily-reading" key={day.dateKey} style={{ gap: 22 }}>
      <DailyTheme showAction={false} />
      <Card><Heading>{t('Небольшой шаг', 'One small step')}</Heading><Body>{content.action}</Body>
        <Body muted>{t('Можно просто обдумать ответ. Его не нужно записывать или отправлять.', 'You can simply think it through. There is nothing to record or submit.')}</Body></Card>
      <Card><Heading>{t('Присмотритесь к этому', 'A closer look')}</Heading>{content.paragraphs.map((paragraph, i) => <Body key={i}>{paragraph}</Body>)}</Card>
      <Body muted>{t('Новая тема появится завтра. Возвращайтесь в удобном для вас ритме.', 'A new theme arrives tomorrow. Return at a pace that suits you.')}</Body>
      {me && chapter && <Card><Heading>{t('Продолжить эту тему', 'Explore this theme')}</Heading>
        <AppLink testID="daily-open-my-chapter"
          href={`/matrix?chapter=${chapter.key}`} label={chapterTitle(chapter.title)} />
      </Card>}
      <Body muted>{t('Тема дня общая для всех и не рассчитывается по дате рождения.',
        'Today’s theme is shared by everyone and is not calculated from a birth date.')}</Body>
      <AppLink href="/" label={t('К «Сегодня»', 'Back to Today')} />
    </View>
  </Page>;
}
