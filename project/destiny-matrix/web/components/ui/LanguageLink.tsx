"use client";

import { D } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n/selection";
import { useTransition } from "react";
import { useLocale, useRefreshLocale, useSite } from "./LocaleProvider";
import { navigationHref, splitPublicPath } from "@/lib/publicRouting";

/** Every page switches its URL language on the current host without dropping form state. */
export default function LanguageLink({ plain = false }: { plain?: boolean } = {}) {
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
            const current = new URL(location.href);
            const route = splitPublicPath(current.pathname);
            // The standalone 404 has no route tree to refresh. Its unknown path still
            // needs a language prefix, and a full navigation refreshes metadata as well.
            if (plain) {
              current.searchParams.delete("lang");
              location.assign(`/${next}${route.path === "/" ? "/" : route.path}${current.search}${current.hash}`);
              return;
            }
            document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
            try { localStorage.setItem(LOCALE_COOKIE, next); } catch { /* Cookies also work without storage. */ }
            startTransition(() => {
              const url = new URL(location.href);
              url.searchParams.delete("lang");
              // Preserve the mounted form and session, then refresh server content in the URL language.
              window.history.replaceState(null, "", `${navigationHref(route.path, site, next)}${url.search}${url.hash}`);
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
