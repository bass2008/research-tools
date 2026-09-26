"use client";

import { D } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n/selection";
import { useTransition } from "react";
import { useLocale, useRefreshLocale, useSite } from "./LocaleProvider";

/** Switch the current page without changing the host, session or calculation. */
export default function LanguageLink() {
  const locale = useLocale();
  const site = useSite();
  const refreshLocale = useRefreshLocale();
  const [pending, startTransition] = useTransition();
  if (site.locales.length < 2) return null;
  return (
    <span aria-busy={pending}>
      {site.locales.filter((item) => item !== locale).map((next) => (
        <button
          key={next}
          type="button"
          className="language-switch"
          data-testid={`language-${next}`}
          lang={next}
          disabled={pending}
          onClick={() => {
            document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
            try { localStorage.setItem(LOCALE_COOKIE, next); } catch { /* Cookies also work without storage. */ }
            startTransition(() => {
              const url = new URL(location.href);
              if (url.searchParams.has("lang")) {
                url.searchParams.set("lang", next);
                // A query-only navigation reuses layouts. Update the URL, then explicitly
                // refresh the whole server tree so html.lang and the provider change too.
                window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
              }
              refreshLocale(next);
            });
          }}
        >
          {D.nav.otherLanguage[next]}
        </button>
      ))}
    </span>
  );
}
