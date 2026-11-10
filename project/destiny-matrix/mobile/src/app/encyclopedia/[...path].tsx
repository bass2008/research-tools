import { useLocalSearchParams } from 'expo-router';
import { Article } from '../../components/Article';
export default function EncyclopediaArticle() {
  const { path, ...params } = useLocalSearchParams<{ path: string[]; [key: string]: string | string[] }>();
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    // `lang` selects the app locale; it is not an article query parameter.
    if (key === 'lang') return;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  });
  return <Article path={`/encyclopedia/${(Array.isArray(path) ? path : [path]).join('/')}${query.size ? `?${query}` : ''}`} />;
}
