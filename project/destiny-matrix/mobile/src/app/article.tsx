import { useLocalSearchParams } from 'expo-router';
import { Article } from '../components/Article';
export default function ArticleScreen() { const { path } = useLocalSearchParams<{ path: string }>(); return <Article path={path ?? '/encyclopedia'} />; }
