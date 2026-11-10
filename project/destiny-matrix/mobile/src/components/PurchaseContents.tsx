import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { forLocale as matrixForLocale } from '@/lib/matrix';
import { isMobileSections } from '@/lib/mobileContentContract';
import { useApp } from '../state/AppState';
import { useRemote } from '../state/useRemote';
import { useReadingProgress } from '../state/useReadingProgress';
import { personalReaderKey } from '../native/personalReading';
import { Body, Heading, RemoteStatus, styles } from './ui';
import { ChapterContents } from './ChapterContents';
import { Kicker } from './DesignElements';

export function PurchaseContents({ birth, sex }: { birth: string; sex?: string }) {
  const { locale, session, t } = useApp();
  const [expanded, setExpanded] = useState(false);
  const engine = matrixForLocale(locale);
  let matrix;
  try { matrix = engine.calculate(birth, sex === 'm' ? 'm' : 'f'); } catch { matrix = null; }
  const remote = useRemote(matrix
    ? `/sections?preview=free&slug=${matrix.day}-${matrix.month}-${matrix.year}` : null, isMobileSections);
  const { readKeys } = useReadingProgress(personalReaderKey({ birth, sex: sex === 'm' ? 'm' : 'f' }, session?.user.id));
  if (!matrix) return null;
  const sections = remote.data?.sections;
  const closed = sections?.filter(s => s.locked) ?? [];
  const read = sections?.filter(s => s.access === 'free' && readKeys.includes(s.key)).length ?? 0;
  const freeChapterLabel = read === 1 ? 'бесплатную главу' : read >= 2 && read <= 4 ? 'бесплатные главы' : 'бесплатных глав';
  return <View testID="purchase-contents" style={{ gap: 12 }}>
    <Kicker>{t('Ваш полный разбор', 'Your full reading')}</Kicker>
    <Heading>{engine.birthLabel(matrix.birth)}</Heading>
    <RemoteStatus {...remote} />
    {sections && <>
      <Body>{t(`Откроются главы вашей даты · ${closed.length}`, `Chapters for your date to unlock · ${closed.length}`)}</Body>
      <ChapterContents sections={expanded ? closed : closed.slice(0, 3)} order={sections} />
      {closed.length > 3 && <Pressable testID="purchase-all-chapters" accessibilityRole="button"
        accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)}
        style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={styles.link}>{expanded ? t('Свернуть список', 'Collapse list')
          : t(`Все закрытые главы · ${closed.length}`, `All locked chapters · ${closed.length}`)}</Text>
      </Pressable>}
      <Body muted>{t(`Вы прочитали ${read} ${freeChapterLabel}`, `You have read ${read} free ${read === 1 ? 'chapter' : 'chapters'}`)}</Body>
    </>}
  </View>;
}
