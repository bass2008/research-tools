import { AppLink } from '../components/AppLink';
import { Body, Page } from '../components/ui';
import { useApp } from '../state/AppState';
export default function NotFound() { const { t } = useApp(); return <Page title={t('Страница не найдена', 'Page not found')}><Body>{t('Проверьте ссылку или вернитесь к расчёту.', 'Check the link or return to the calculator.')}</Body><AppLink href="/calculate" label={t('Калькулятор', 'Calculator')} /></Page>; }
