import { useEffect, useId, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { forLocale as mapForLocale } from '@/lib/matrixMap';
import { CHAKRA_COLORS } from '@/lib/octagramColors';
import { D } from '@/lib/i18n';
import type { YearKey } from '@/lib/yearMatrix';
import { useApp } from '../state/AppState';
import { AppLink } from './AppLink';
import { colors, fonts, styles } from './ui';
import { CENTER as C, INNER, OUTER, OUTLINE, YEAR_EDGES, YEAR_RADIUS, YEAR_THIRDS, hitRegion, linkPath, nodeSize, polygon, xy } from './matrixMapGeometry';

const FONT = fonts.bold;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const OUTLINE_LENGTH = 16 * OUTER * Math.sin(Math.PI / 8);
const color: Record<string, string> = { A: CHAKRA_COLORS[2], B: CHAKRA_COLORS[6], C: CHAKRA_COLORS[4], D: CHAKRA_COLORS[0],
  E: '#0e8f88', F: CHAKRA_COLORS[5], G: CHAKRA_COLORS[5], H: CHAKRA_COLORS[3], I: CHAKRA_COLORS[1] };
const frame = { ring: '#dbe4e9', side: '#8399a8', diag: '#b3c2cc', axis: '#cbd6dd', label: '#8395a3' };
const yearFrame = { ring: '#eadbb8', side: '#d8c290', diag: '#e2cfa2', axis: '#e2d0a6', label: '#9a7f45' };

export interface MatrixMapProps {
  points: Record<string, number>;
  highlight?: string[];
  year?: boolean;
  selectedPoint?: string;
  onSelectPoint?: (symbol: string) => void;
  showCaption?: boolean;
  miniature?: boolean;
  variant?: 'personal' | 'pair';
  /** Existing model links, for the year chart; no recalculation or entitlement lookup here. */
  links?: { keys: readonly string[]; color: string }[];
}

export function MatrixMap({ points, highlight = [], year = false, variant = 'personal', links = [], selectedPoint, onSelectPoint, showCaption = true, miniature = false }: MatrixMapProps) {
  const { locale, t } = useApp();
  const map = mapForLocale(locale);
  const [localSelected, setSelected] = useState<string | null>(null);
  const selected = selectedPoint ?? localSelected;
  const [reducedMotion, setReducedMotion] = useState(true);
  const [outlineProgress] = useState(() => new Animated.Value(1));
  const [focusProgress] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let live = true;
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReducedMotion(value); }).catch(() => {});
    return () => { live = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (reducedMotion) { outlineProgress.setValue(1); return; }
    outlineProgress.setValue(0);
    const animation = Animated.timing(outlineProgress, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: false, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, outlineProgress]);
  useEffect(() => {
    if (reducedMotion || !selected) { focusProgress.setValue(1); return; }
    focusProgress.setValue(0);
    const animation = Animated.timing(focusProgress, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [selected, reducedMotion, focusProgress]);
  const [width, setWidth] = useState(350);
  const gradientId = useId().replace(/\W/g, '');
  const guide = Object.keys(points).length === 0;
  const palette = year ? yearFrame : frame;
  const places = year ? [
    ...map.MAP_POINTS.filter(point => point.radius === OUTER || point.radius === 0),
    ...Object.entries(YEAR_THIRDS).map(([symbol, angle]) => ({ key: symbol, symbol, label: '', angle, radius: YEAR_RADIUS, size: 'mid' as const })),
  ] : map.MAP_POINTS;
  const nodes = places.flatMap(point => {
    const value = guide ? point.symbol : points[point.symbol] ?? points[point.key];
    const label = year ? D.yearLinks.points[locale][point.symbol as YearKey]?.[0] ?? point.label : point.label;
    return value ? [{ ...point, label, value }] : [];
  });
  const positions = new Map(nodes.map(point => [point.symbol, xy(point.angle, point.radius)]));
  const owners = new Map(links.flatMap(link => link.keys.map(key => [key, link.color] as const)));
  const active = nodes.find(point => point.symbol === selected);
  const marked = (key: string, symbol: string) => highlight.includes(key) || highlight.includes(symbol);
  const showAges = !year && !guide && variant === 'personal';
  const showAxesLabels = !year && !guide && variant === 'personal';
  const summary = ['A', 'B', 'C', 'D', 'E'].map(symbol => points[symbol] ?? points[map.MAP_POINTS.find(point => point.symbol === symbol)!.key]).filter(Boolean).join(' · ');

  return <View style={chart.wrap} onLayout={event => { if (event.nativeEvent.layout.width > 0) setWidth(event.nativeEvent.layout.width); }}>
    <Svg testID="matrix-chart" viewBox="0 0 620 620" width="100%" style={chart.svg}
      accessibilityLabel={year ? t('Матрица года', 'Year matrix') : t('Схема матрицы', 'Matrix chart')}>
      {year && <>
        <Defs><LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#fffaf0" /><Stop offset="100%" stopColor="#f6ecd4" />
        </LinearGradient></Defs>
        <Rect x={0} y={0} width={620} height={620} rx={24} fill={`url(#${gradientId})`} />
      </>}
      <G accessible={false}>
        <Circle cx={C} cy={C} r={OUTER + (year ? 30 : 38)} fill="none" stroke={palette.ring} />
        <Circle cx={C} cy={C} r={OUTER + (year ? 18 : 22)} fill="none" stroke={palette.ring} />
        {showAges && Array.from({ length: 80 }, (_, index) => {
          const angle = 180 + index * 4.5, [x1, y1] = xy(angle, OUTER + 22), [x2, y2] = xy(angle, OUTER + (index % 5 ? 27 : 31));
          const [tx, ty] = xy(angle, OUTER + 44);
          return <G key={index}>
            <Line testID={`matrix-age-tick-${index}`} {...{ x1, y1, x2, y2 }} stroke="#b9c6ce" strokeWidth={index % 5 ? 0.8 : 1.4} />
            {index > 0 && index % 10 === 0 && <SvgText x={tx} y={ty + 5} textAnchor="middle" fontFamily={FONT} fontSize={16} fill={palette.label}>{index}</SvgText>}
          </G>;
        })}
        <AnimatedPolygon testID="matrix-outline" points={polygon(OUTLINE, OUTER)} fill="none" stroke={palette.side} strokeWidth={1.8}
          strokeDasharray={`${OUTLINE_LENGTH} ${OUTLINE_LENGTH}`} strokeDashoffset={outlineProgress.interpolate({ inputRange: [0, 1], outputRange: [OUTLINE_LENGTH, 0] })} />
        <Polygon testID="matrix-cardinal-frame" points={polygon([-90, 0, 90, 180], year ? OUTER : INNER)} fill="none" stroke={palette.diag} strokeWidth={1.2} />
        <Polygon testID="matrix-diagonal-frame" points={polygon([-45, 45, 135, 225], year ? OUTER : INNER)} fill="none" stroke={palette.diag} strokeWidth={1.2} />
        {[180, 225, -90, -45].map(angle => {
          const [x1, y1] = xy(angle, OUTER), [x2, y2] = xy(angle + 180, OUTER);
          return <Line key={angle} {...{ x1, y1, x2, y2 }} stroke={palette.axis} strokeWidth={1} strokeDasharray={year ? '2 6' : undefined} />;
        })}
        {showAxesLabels && [[C, C - INNER + 30, D.octagram.sky[locale]], [C, C + INNER - 30, D.octagram.sky[locale]],
          [C - INNER + 4, C - 30, D.octagram.earth[locale]], [C + INNER - 4, C - 30, D.octagram.earth[locale]]].map(([x, y, label], index) =>
          <SvgText key={index} x={x} y={Number(y) + 5} textAnchor="middle" fontFamily={FONT} fontSize={16} letterSpacing={1} fill={palette.label}>{String(label).toUpperCase()}</SvgText>)}
        {year && <>
          <Circle testID="matrix-year-wheel" cx={C} cy={C} r={YEAR_RADIUS} fill="none" stroke="#c9a95c" strokeWidth={1.2} strokeDasharray="3 5" />
          {YEAR_EDGES.map(angle => {
            const [x1, y1] = xy(angle, YEAR_RADIUS - 9), [x2, y2] = xy(angle, YEAR_RADIUS + 9);
            return <Line key={angle} {...{ x1, y1, x2, y2 }} stroke="#c9a95c" strokeWidth={1.6} />;
          })}
          {Object.values(YEAR_THIRDS).map((angle, index) => {
            const side = Math.cos(angle * Math.PI / 180), [x, y] = xy(angle, YEAR_RADIUS + (Math.abs(side) > 0.3 ? 26 : 44));
            return <SvgText key={angle} x={x} y={y + (Math.abs(side) > 0.3 ? -14 : 12)}
              textAnchor={side > 0.3 ? 'start' : side < -0.3 ? 'end' : 'middle'} fontFamily={FONT} fontSize={22} fill={palette.label}>{D.yearLinks.wheel[locale][index]}</SvgText>;
          })}
        </>}
        {links.map((link, index) => <Path key={index} testID={`matrix-link-${index}`} d={linkPath(link.keys, positions)} stroke={link.color}
          fill="none" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" opacity={selected && !link.keys.includes(selected) ? 0.2 : 1} />)}
      </G>
      {nodes.map(point => {
        const [x, y] = xy(point.angle, point.radius), focused = marked(point.key, point.symbol) || selected === point.symbol;
        const size = nodeSize(point, guide), linkColor = owners.get(point.symbol);
        const fill = guide ? focused ? colors.teal : '#ced9e0' : year ? linkColor ? '#ffffff' : point.size === 'big' ? '#fff4dc' : '#fffaf0' : color[point.symbol] ?? '#7d92a1';
        const ink = guide ? focused ? '#ffffff' : '#60707c' : year ? linkColor ? '#121b29' : '#6b5a35' : '#ffffff';
        const opacity = !guide && selected && !focused ? 0.55 : !guide && highlight.length && !focused ? 0.35 : variant === 'pair' && ['S', 'T'].includes(point.symbol) && !focused ? 0.55 : 1;
        return <G key={point.symbol} accessible={false} opacity={opacity}>
          {focused && <AnimatedCircle testID={`matrix-focus-${point.symbol}`} cx={x} cy={y}
            r={selected === point.symbol ? focusProgress.interpolate({ inputRange: [0, 1], outputRange: [size.radius + 17, size.radius + 8] }) : size.radius + 8}
            stroke={colors.teal} strokeWidth={guide ? 8 : 3} strokeOpacity={guide ? 0.4 : 0.8} fill="none" />}
          {year && linkColor && <Circle cx={x} cy={y} r={size.radius + 5} fill="#ffffff" stroke={linkColor} strokeWidth={4} />}
          <Circle testID={`matrix-dot-${point.symbol}`} cx={x} cy={y} r={size.radius} fill={fill}
            stroke={year && !linkColor ? '#d6bf8a' : 'none'} strokeWidth={1.2} />
          <SvgText x={x} y={y + size.font * 0.35} textAnchor="middle" fontFamily={FONT} fontSize={size.font} fill={ink}>{point.value}</SvgText>
        </G>;
      })}
      {/* Separate top layer: decoration cannot expand a neighbour's touch target. */}
      {!miniature && nodes.map(point => <G key={point.symbol} testID={`matrix-point-${point.symbol}`} accessible
        accessibilityLabel={`${point.label} · ${point.symbol} · ${point.value}`} onPress={() => { setSelected(point.symbol); onSelectPoint?.(point.symbol); }}>
        <Polygon testID={`matrix-hit-${point.symbol}`}
          points={hitRegion(positions.get(point.symbol)!, [...positions.values()], width).map(vertex => vertex.join(',')).join(' ')} fill="transparent" />
      </G>)}
    </Svg>
    {!miniature && <Text testID="matrix-summary" style={[styles.muted, chart.summary]}>{summary}</Text>}
    {showCaption && !miniature && <View style={chart.caption}>
      {active ? <AppLink href={guide ? `/encyclopedia/position/${active.key}` : `/encyclopedia/arcanum/${active.value}`} label={`${active.label} · ${active.value}`} />
        : <Text style={[styles.muted, chart.hint]}>{t('Нажмите на точку схемы', 'Tap a point on the chart')}</Text>}
    </View>}
  </View>;
}

const chart = StyleSheet.create({
  wrap: { gap: 8, width: '100%' },
  svg: { aspectRatio: 1 },
  summary: { textAlign: 'center', letterSpacing: 2 },
  caption: { minHeight: 46, borderTopWidth: 1, borderTopColor: '#edf1f3', paddingTop: 5, justifyContent: 'center' },
  hint: { textAlign: 'center', fontSize: 12 },
});
