import NotFoundBody from "@/components/ui/NotFoundBody";
import { D } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export default async function NotFound() {
  const L = await requestLocale();

  return (
    <main id="content" className="page">
      {/* not-found.tsx не участвует в metadata, поэтому заголовок вкладки задаётся разметкой —
          иначе на 404 стоит заголовок главной, и это видно в истории браузера. */}
      <title>{`${D.meta.notFoundTitle[L]} — Arcana Sense`}</title>
      <meta name="robots" content="noindex" />
      <NotFoundBody locale={L} />
    </main>
  );
}
