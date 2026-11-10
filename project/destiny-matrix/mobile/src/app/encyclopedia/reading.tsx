import { useLocalSearchParams } from 'expo-router';
import { ChapterReader } from '../../components/ChapterReader';
import type { ReportParams } from '../../native/personalReading';

export default function ReadingChapter() {
  const params = useLocalSearchParams<ReportParams & Record<string, string>>();
  return <ChapterReader params={params} />;
}
