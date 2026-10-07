"use client";

import { useEffect } from "react";

import { reportRenderError } from "@/lib/errors";
import { D } from "@/lib/i18n";
import { isLang } from "@/lib/i18n/lang";

// Replaces the root layout, so no providers are available: the language comes from the document.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => reportRenderError(error, "root"), [error]);
  const lang = typeof document !== "undefined" ? document.documentElement.lang.slice(0, 2) : "ru";
  const L = isLang(lang) ? lang : "ru";
  return (
    <html lang={L}>
      <body>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
          <h1 style={{ margin: "0 0 12px" }}>{D.errorScreen.title[L]}</h1>
          <p style={{ margin: "0 0 20px" }}>{D.errorScreen.lead[L]}</p>
          <button type="button" onClick={() => retry()} style={{ marginRight: 12, padding: "10px 16px" }}>{D.errorScreen.retry[L]}</button>
          <a href="/">{D.errorScreen.home[L]}</a>
        </main>
      </body>
    </html>
  );
}
