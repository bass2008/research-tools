import Link from "next/link";

/** Ссылка шапки и подвала.
 *
 *  Страница 404 собирает собственный документ, вне дерева маршрутов. Клиентский роутер в нём
 *  меняет адрес и заголовок вкладки, но тело оставляет прежним — человек остаётся на «Такой
 *  страницы нет». Поэтому там все ссылки переключаются на обычный переход: `plain` идёт сверху
 *  вниз от самой страницы, а не решается в каждой ссылке отдельно. */
export default function SiteLink({
  plain,
  href,
  children,
  ...rest
}: React.ComponentProps<"a"> & { plain?: boolean; href: string }) {
  if (plain) return <a href={href} {...rest}>{children}</a>;
  return <Link href={href} {...rest}>{children}</Link>;
}
