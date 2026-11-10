import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { FlexWidget, ImageWidget, TextWidget, requestWidgetUpdate,
  type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { deck } from '../native/deck';
import { dailyNative } from '../native/dailyNative';
import { widgetModel } from './widgetModel';

function DailyWidget({ model, width, height }: {
  model: ReturnType<typeof widgetModel>; width: number; height: number;
}) {
  const imageWidth = Math.min(80, Math.max(46, (height - 32) / 1.5));
  return <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: model.uri }}
    accessibilityLabel={`${model.label}. ${model.title}. ${model.month}`}
    style={{ width, height, padding: 16, backgroundColor: '#f7f1e6', borderRadius: 22,
      flexDirection: 'row', alignItems: 'center' }}>
    <FlexWidget style={{ width: imageWidth, height: imageWidth * 700 / 520, overflow: 'hidden', borderRadius: 5 }}>
      <ImageWidget image={deck[model.arcanum]!} imageWidth={imageWidth} imageHeight={imageWidth * 1.5} />
    </FlexWidget>
    <FlexWidget style={{ flex: 1, marginLeft: 16, justifyContent: 'center' }}>
      <TextWidget text={model.label} style={{ fontSize: 10, letterSpacing: 1.6, color: '#967941',
        fontFamily: 'Manrope-Regular', marginBottom: 6 }} />
      <TextWidget text={model.cardTitle} maxLines={3} style={{ fontSize: 19, color: '#243632',
        fontFamily: 'CormorantGaramond-SemiBold', marginBottom: 8 }} />
      {!!model.month && <TextWidget text={model.month} maxLines={2}
        style={{ fontSize: 11, color: '#087b75', fontFamily: 'Manrope-Regular', marginBottom: 8 }} />}
      <TextWidget text="Arcana Sense" style={{ fontSize: 13, color: '#7b766b', fontFamily: 'CormorantGaramond-SemiBold' }} />
    </FlexWidget>
  </FlexWidget>;
}

async function readModel() {
  const [locale, raw] = await Promise.all([
    SecureStore.getItemAsync('arcana.locale'), SecureStore.getItemAsync('arcana.me'),
  ]);
  let birth: string | undefined;
  try { birth = raw ? JSON.parse(raw).birth : undefined; } catch { /* A damaged date must not hide today's theme. */ }
  return widgetModel(new Date(), locale === 'en' ? 'en' : 'ru', birth);
}

export async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetInfo.widgetName !== 'DailyTheme') return;
  if (widgetAction !== 'WIDGET_DELETED') {
    const model = await readModel();
    renderWidget(<DailyWidget model={model} width={widgetInfo.width} height={widgetInfo.height} />);
  }
  await dailyNative?.schedule();
}

export async function updateDailyWidget() {
  if (Platform.OS !== 'android') return;
  const model = await readModel();
  await requestWidgetUpdate({ widgetName: 'DailyTheme',
    renderWidget: info => <DailyWidget model={model} width={info.width} height={info.height} /> });
  await dailyNative?.schedule();
}
