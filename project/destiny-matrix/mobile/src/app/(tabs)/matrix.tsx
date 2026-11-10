import { useLocalSearchParams } from 'expo-router';
import { PersonalReport } from '../../components/PersonalReport';
import { useMyReading } from '../../state/useMyReading';
import { useApp } from '../../state/AppState';
import { Page } from '../../components/ui';
import { MyDateForm } from '../../components/MyDateForm';
import { TabHeading } from '../../components/TabHeading';

export default function MyMatrix() {
  const { t } = useApp();
  const { me, params } = useMyReading();
  const { point, chapter, selection } = useLocalSearchParams<{ point?: string; chapter?: string; selection?: string }>();
  if (!me) return <Page tab>
    <TabHeading title={t('Матрица', 'Matrix')} />
    <MyDateForm />
  </Page>;
  return <PersonalReport key={JSON.stringify([params, chapter, point, selection])}
    tab params={{ ...params, point, chapter: point ? undefined : chapter, selection }} />;
}
