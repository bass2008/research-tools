import { record } from './http';
import type { ReadingItem, MatrixListItem, NotificationPage } from '@/lib/api';

export interface Session {
  token: string;
  user: { id: number; email: string; email_verified_at?: string | null; has_password?: boolean };
  deletion?: { requested_at: string; delete_at: string; renewal_cancellation: 'complete' | 'pending' } | null;
}
export const isSession = (v: unknown): v is Session => record(v) && typeof v.token === 'string' &&
  record(v.user) && Number.isInteger(v.user.id) && typeof v.user.email === 'string' &&
  (v.user.has_password === undefined || typeof v.user.has_password === 'boolean') &&
  (v.deletion === undefined || v.deletion === null || record(v.deletion) &&
    typeof v.deletion.requested_at === 'string' && Number.isFinite(Date.parse(v.deletion.requested_at)) &&
    typeof v.deletion.delete_at === 'string' && Number.isFinite(Date.parse(v.deletion.delete_at)) &&
    ['complete', 'pending'].includes(String(v.deletion.renewal_cancellation)));
export const isUser = (v: unknown): v is { user: Session['user']; access: Record<string, unknown>; pending_email_change?: unknown } =>
  record(v) && record(v.user) && Number.isInteger(v.user.id) && typeof v.user.email === 'string' &&
  (v.user.has_password === undefined || typeof v.user.has_password === 'boolean') && record(v.access);
const access = ['open', 'forever', 'granted', 'subscription', 'locked'];
export const isReading = (v: unknown): v is ReadingItem => record(v) && Number.isInteger(v.id) &&
  typeof v.product === 'string' && record(v.inputs) && access.includes(String(v.access)) &&
  (v.access_until === null || typeof v.access_until === 'string');
export const isMatrix = (v: unknown): v is MatrixListItem => record(v) && Number.isInteger(v.id) &&
  typeof v.birth === 'string' && (v.sex === 'f' || v.sex === 'm') && access.includes(String(v.access)) &&
  (v.access_until === null || typeof v.access_until === 'string');
export const isReadingList = (v: unknown): v is { items: ReadingItem[] } => record(v) && Array.isArray(v.items) && v.items.every(isReading);
export const isMatrixList = (v: unknown): v is { items: MatrixListItem[] } => record(v) && Array.isArray(v.items) && v.items.every(isMatrix);
export const isNotifications = (v: unknown): v is NotificationPage => record(v) && Array.isArray(v.items) &&
  typeof v.unread_count === 'number' && v.items.every(x => record(x) && typeof x.delivery_id === 'number' &&
    typeof x.title === 'string' && typeof x.text === 'string' && record(x.action) && typeof x.action.href === 'string');
export const isNumberTextMap = (v: unknown): v is Record<string, string> => record(v) && Object.values(v).every(x => typeof x === 'string');
export const isUrl = (v: unknown): v is { url: string } => record(v) && typeof v.url === 'string';
