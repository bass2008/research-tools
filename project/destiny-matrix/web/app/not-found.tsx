import NotFoundBody from "@/components/ui/NotFoundBody";

export default function NotFound() {
  return (
    <main id="content" className="page">
      {/* not-found.tsx не участвует в metadata, поэтому заголовок вкладки задаётся разметкой —
          иначе на 404 стоит заголовок главной, и это видно в истории браузера. */}
      <title>Страница не найдена — Arcana Sense</title>
      <meta name="robots" content="noindex" />
      <NotFoundBody />
    </main>
  );
}
