import { useLocalSearchParams } from 'expo-router';
import { DemoReading } from '../../components/DemoReading';

export default function Demo() {
  const { view, chapter } = useLocalSearchParams<{ view?: string; chapter?: string }>();
  const initialScene = view === 'reading' ? 'reading' : 'chart';
  return <DemoReading key={`${initialScene}:${chapter ?? ''}`} initialScene={initialScene} initialChapter={typeof chapter === 'string' ? chapter : undefined} />;
}
