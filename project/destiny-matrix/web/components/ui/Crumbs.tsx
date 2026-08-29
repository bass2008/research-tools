import Link from "next/link";
import { Fragment } from "react";

import { breadcrumbLd, type Crumb } from "@/lib/schema";

import JsonLd from "@/components/ui/JsonLd";

// Крошки и их разметка выводятся одним компонентом: пока они жили порознь, на страницах была
// видимая цепочка без BreadcrumbList, и поиск строил хлебные крошки сам, как умел.
export default function Crumbs({ trail }: { trail: Crumb[] }) {
  return (
    <>
      <JsonLd data={breadcrumbLd(trail)} />
      <p className="crumbs">
        {trail.map((c, i) => (
          <Fragment key={`${c.name}-${i}`}>
            {i > 0 ? <span>/</span> : null}
            {c.path ? <Link href={c.path}>{c.name}</Link> : <span>{c.name}</span>}
          </Fragment>
        ))}
      </p>
    </>
  );
}
