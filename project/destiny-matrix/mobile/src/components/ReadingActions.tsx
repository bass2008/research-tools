import { useState } from 'react';
import { Share, View } from 'react-native';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useApp } from '../state/AppState';
import { Action, Body } from './ui';
import { ApiError, isRecord } from '../native/http';
import { isUrl } from '../native/contracts';
import { cacheGeneration, privateDir, readCache, writeCache, type Grant } from '../native/cache';

export function ReadingActions({ id, unlocked, until }: { id: number; unlocked: boolean; until: string | null }) {
  const { api, base, locale, session, t } = useApp();
  const [saved, setSaved] = useState(false);
  async function pdf() {
    if (!session) return;
    const epoch = cacheGeneration();
    const grant: Grant = { userId: session.user.id, until, readingId: id };
    const key = JSON.stringify(['pdf-v1', base, locale, session.user.id, id]);
    const dir = privateDir(); dir.create({ idempotent: true, intermediates: true });
    const output = new File(dir, `report-${session.user.id}-${id}-${locale}.pdf`);
    const temporary = new File(dir, `download-${Date.now()}-${id}.part`);
    try {
      const result = await api('/reports/pdf', isUrl, { method: 'POST', body: { reading_id: id }, timeout: 180000 });
      const url = new URL(result.url, base);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid PDF URL');
      // The report URL is signed. Never forward the account token to a storage host.
      await File.downloadFileAsync(url.href, temporary, { idempotent: true });
      if (epoch !== cacheGeneration()) { if (temporary.exists) temporary.delete(); return; }
      const handle = temporary.open();
      try { if (String.fromCharCode(...handle.readBytesSync(5)) !== '%PDF-') throw new Error(t('Некорректный PDF', 'Invalid PDF')); }
      finally { handle.close(); }
      await temporary.move(output, { overwrite: true });
      if (epoch !== cacheGeneration()) { if (output.exists) output.delete(); return; }
      await writeCache(key, { uri: output.uri }, grant, epoch);
    } catch (error) {
      if (temporary.exists) temporary.delete();
      if (error instanceof ApiError && error.status > 0 && error.status < 500) { if (output.exists) output.delete(); throw error; }
      const cached = await readCache(key, isRecord, session.user.id);
      if (!cached || !output.exists) throw error;
    }
    if (epoch !== cacheGeneration()) return;
    setSaved(true);
    const canPreview = await output.canPreview();
    if (epoch !== cacheGeneration()) return;
    if (canPreview) await output.preview({ mimeType: 'application/pdf' });
    else await Sharing.shareAsync(output.uri, { mimeType: 'application/pdf' });
  }
  return <View style={{ gap: 12 }}>
    {unlocked && <Action secondary testID="reading-pdf" title={t('Открыть / сохранить PDF', 'Open / save PDF')} onPress={pdf} />}
    {saved && <Body muted>{t('PDF сохранён в приложении. Экспортированный файл останется у получателя после выхода из аккаунта.', 'PDF saved in the app. An exported copy remains with the recipient after you sign out.')}</Body>}
    <Action secondary testID="reading-share" title={t('Поделиться', 'Share')} onPress={async () => {
      const result = await api(`/readings/${id}/share`, isRecord, { method: 'POST', body: {} });
      if (typeof result.token !== 'string') throw new Error(t('Не удалось получить ссылку', 'Unable to create the link'));
      await Share.share({ message: `${base}/${locale}/s/${encodeURIComponent(result.token)}` });
    }} />
  </View>;
}
