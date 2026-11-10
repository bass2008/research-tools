import { StyleSheet, Text, View } from 'react-native';
import { useDesign } from '../state/Design';
import { MatrixMap, type MatrixMapProps } from './MatrixMap';
import { Action, Body, Paper, fonts, styles } from './ui';

interface ChartCoverProps extends MatrixMapProps {
  title: string;
  dates?: string[];
  subtitle?: string;
  caption?: string;
  action?: { title: string; onPress: () => void; testID?: string };
  testID?: string;
}

export function ChartCover({ title, dates = [], subtitle, caption, action, testID, ...map }: ChartCoverProps) {
  const { design } = useDesign();
  const titleBlock = <View style={{ gap: 6, alignItems: 'center' }}>
    <Text style={[styles.eyebrow, { color: design.gold, textAlign: 'center' }]}>{title}</Text>
    {dates.map((date, i) => <Text key={`${date}-${i}`} accessibilityRole="header" style={s.date}>{date}</Text>)}
    {subtitle && <Text style={[styles.muted, { textAlign: 'center' }]}>{subtitle}</Text>}
  </View>;
  const chart = <View testID={testID} style={s.chart}><MatrixMap {...map} /></View>;
  const end = <>{caption && <Body muted>{caption}</Body>}{action && <Action {...action} />}</>;
  return <View testID="chart-cover-atelier">
    <Paper style={{ gap: 18, padding: 16, marginRight: 3, boxShadow: `3px 3px 0 0 ${design.border}, 0 12px 24px -18px rgba(50,40,20,0.3)` }}>
      <View style={[s.rule, { borderColor: design.border }]}><Text style={[styles.eyebrow, { color: design.gold }]}>ARCANA SENSE</Text><Text style={[s.folio, { color: design.gold }]}>I</Text></View>
      {titleBlock}{chart}<View style={[s.endRule, { borderColor: design.border }]}>{end}</View>
    </Paper>

  </View>;
}

const s = StyleSheet.create({
  chart: { width: '100%', alignSelf: 'center' },
  date: { fontFamily: fonts.display, fontSize: 29, lineHeight: 37, paddingBottom: 3, color: '#243632', textAlign: 'center' },
  rule: { borderBottomWidth: 1, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  folio: { fontFamily: fonts.display, fontSize: 23, lineHeight: 28 },
  endRule: { borderTopWidth: 1, paddingTop: 14, gap: 12 },
});
