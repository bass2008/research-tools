import { Pressable, StyleSheet, Text, View } from 'react-native';
import { D } from '@/lib/i18n';
import { forLocale as arcanaForLocale } from '@/lib/arcana';
import { monthPoints, yearMatrix } from '@/lib/yearMatrix';
import { useApp } from '../state/AppState';
import { useRemote } from '../state/useRemote';
import { articlePreview, isPublicArticle } from '../native/articlePreview';
import { AppLink, useNavigate } from './AppLink';
import { ArcanumImage } from './ArcanumImage';
import { RichText, colors, fonts } from './ui';
import { Kicker } from './DesignElements';
import { Icon } from './BrandArt';

export function TodayForecast({ birth, year, month }: { birth: string; year: number; month: number }) {
  const { locale, t } = useApp();
  const navigate = useNavigate();
  const [y, m, d] = birth.split('-').map(Number);
  const catalog = arcanaForLocale(locale);
  const monthly = catalog.arcanum(monthPoints({ y, m, d }, year, month).E);
  const forecast = yearMatrix({ y, m, d }, year);
  const yearly = catalog.arcanum(forecast.centre);
  const monthRemote = useRemote('/content?path=%2Fencyclopedia%2Fmonth', isPublicArticle);
  const yearRemote = useRemote(`/content?path=${encodeURIComponent(`/year/${yearly.n}`)}`, isPublicArticle);
  const monthText = articlePreview(monthRemote.data, monthly.n) ?? monthly.short;
  const yearText = articlePreview(yearRemote.data) ?? yearly.short;
  const monthName = new Date(year, month - 1, 1).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', { month: 'long' });
  const period = Math.floor((month - 1) / 4);
  return <View style={s.forecast}>
    <Pressable testID="today-month" accessibilityRole="link" style={s.section}
      onPress={() => { void navigate('/encyclopedia/month'); }}>
      <Kicker>{`${t('Ваш месяц', 'Your month')} · ${monthName}`}</Kicker>
      <View style={s.cardHeading}>
        <ArcanumImage n={monthly.n} width={52} decorative />
        <Text style={s.title}>{monthly.n} · {monthly.title}</Text>
        <Icon name="arrow" color={colors.gold} size={16} />
      </View>
      <RichText text={monthText} />
    </Pressable>
    <View style={s.section}>
      <Pressable testID="today-year" accessibilityRole="link" style={{ gap: 12 }} onPress={() => { void navigate(`/year/${yearly.n}`); }}>
        <Kicker>{`${t('Ваш год', 'Your year')} · ${year}`}</Kicker>
        <Text style={s.title}>{yearly.n} · {yearly.title} →</Text>
        <RichText text={yearText} />
      </Pressable>
      <View style={s.periods}>
        {forecast.periods.map((n, index) => {
          const key = (['P1', 'P2', 'P3'] as const)[index];
          const current = index === period;
          return <Pressable key={key} testID={`year-period-${key}`} accessibilityRole="link"
            accessibilityState={{ selected: current }} accessibilityLabel={`${key}. ${D.yearLinks.points[locale][key][0]}. ${n}. ${catalog.arcanumTitle(n)}${current ? `. ${t('Сейчас', 'Now')}` : ''}`}
            onPress={() => { void navigate(`/year/${n}`); }} style={[s.period, current && s.current]}>
            <Text style={[s.periodLabel, current && { color: '#087b75' }]}>{key}{current ? ` · ${t('Сейчас', 'Now')}` : ''}</Text>
            <ArcanumImage n={n} width={54} decorative />
            <Text style={s.periodNumber}>{n} · {catalog.arcanumTitle(n)}</Text>
            <Text style={s.months}>{D.yearLinks.points[locale][key][0]}</Text>
          </Pressable>;
        })}
      </View>
      <AppLink testID="today-year-chart" href={`/year?birth=${birth}&year=${year}`}
        label={t('Посмотреть схему года →', 'View the year chart →')} />
    </View>
  </View>;
}

const s = StyleSheet.create({
  forecast: { gap: 24 },
  section: { borderTopWidth: 1, borderColor: '#cdbd9d', paddingTop: 22, gap: 16 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 27, lineHeight: 33, color: '#243632' },
  periods: { flexDirection: 'row', gap: 6, alignItems: 'stretch' },
  period: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4,
    borderWidth: 1, borderColor: 'transparent', borderRadius: 8 },
  current: { borderColor: '#9cb8a7', backgroundColor: '#e1e7dc' },
  periodLabel: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 16, color: colors.muted },
  periodNumber: { fontFamily: fonts.body, fontSize: 11, lineHeight: 17, textAlign: 'center', color: '#243632' },
  months: { fontFamily: fonts.body, fontSize: 10, lineHeight: 16, textAlign: 'center', color: colors.muted },
});
