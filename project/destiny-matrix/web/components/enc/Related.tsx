import Link from "next/link";

import { relatedBoth } from "@/lib/related";

export default function Related({
  path,
  refs,
  skip = [],
  title = "Смотрите также",
  hint = "Страницы, на которые ссылается разбор, и те, что ссылаются на него",
}: {
  path: string;
  refs: string[];
  /** адреса, которые страница уже показала отдельным блоком: иначе ссылка печатается дважды */
  skip?: string[];
  title?: string;
  hint?: string;
}) {
  const links = relatedBoth(path, refs).filter((l) => !skip.includes(l.href));
  if (!links.length) return null;
  return (
    <div className="panel section-gap">
      <h3>{title}</h3>
      <div className="cap">{hint}</div>
      <div className="taglist">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
