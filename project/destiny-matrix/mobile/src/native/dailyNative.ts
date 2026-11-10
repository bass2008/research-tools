import { requireOptionalNativeModule } from 'expo';

export interface ReminderState { enabled: boolean; hour: number; minute: number; locale: 'ru' | 'en' }
interface DailyNative {
  getState(): Promise<ReminderState>;
  configure(locale: 'ru' | 'en', titles: string[]): Promise<ReminderState>;
  setReminder(enabled: boolean, hour: number, minute: number): Promise<ReminderState>;
  schedule(): Promise<void>;
}

export const dailyNative = requireOptionalNativeModule<DailyNative>('ArcanaDaily');
export const defaultReminder: ReminderState = { enabled: false, hour: 9, minute: 0, locale: 'ru' };
export const reminderTime = ({ hour, minute }: Pick<ReminderState, 'hour' | 'minute'>) =>
  `${hour}:${String(minute).padStart(2, '0')}`;
