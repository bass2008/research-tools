"use client";

import Link from "@/components/ui/LocalizedLink";
import { useEffect } from "react";

import { useLocale } from "@/components/ui/LocaleProvider";
import { reportRenderError } from "@/lib/errors";
import { D } from "@/lib/i18n";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const L = useLocale();
  useEffect(() => reportRenderError(error, "page"), [error]);
  return (
    <main id="content" className="page">
      <div className="wrap error-screen" data-testid="error-screen">
        <h1>{D.errorScreen.title[L]}</h1>
        <p>{D.errorScreen.lead[L]}</p>
        <div className="actions">
          <button type="button" className="btn" onClick={() => retry()}>{D.errorScreen.retry[L]}</button>
          <Link className="btn ghost" href="/">{D.errorScreen.home[L]}</Link>
        </div>
      </div>
    </main>
  );
}
