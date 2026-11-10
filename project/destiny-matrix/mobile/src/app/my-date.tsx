import { useApp } from '../state/AppState';
import { Page } from '../components/ui';
import { MyDateForm } from '../components/MyDateForm';

export default function MyDateScreen() {
  const { t } = useApp();
  return <Page title={t('Моя дата', 'My birth date')}><MyDateForm editing /></Page>;
}
