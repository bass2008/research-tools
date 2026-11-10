// Router must register after the error handler has been installed.
/* eslint-disable import/first */
import { startErrorReports } from './src/native/errors';
startErrorReports();
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/daily/DailyWidget';
registerWidgetTaskHandler(widgetTaskHandler);
import 'expo-router/entry';
