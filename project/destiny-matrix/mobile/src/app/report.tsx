import { useLocalSearchParams } from 'expo-router';
import { PersonalReport } from '../components/PersonalReport';
import type { ReportParams } from '../native/personalReading';

export default function Report() {
  const params = useLocalSearchParams<ReportParams & Record<string, string>>();
  return <PersonalReport params={params} />;
}
