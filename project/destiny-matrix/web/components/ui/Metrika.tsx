"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";

import { alive, metrikaId, notBounce } from "@/lib/analytics";
import { trackEngagement } from "@/lib/engagement";
import { useSite } from "./LocaleProvider";

// Сайт одноэкранный: без notBounce отказы стабильно около 90 % и тест трафика
// ничего не измеряет. Пятнадцать секунд — порог из плана запуска.
const NOT_BOUNCE_MS = 15_000;

export default function Metrika() {
  const id = metrikaId(useSite());
  const path = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const t = window.setTimeout(notBounce, NOT_BOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [id, path]);

  // Длительность визита в Метрике — расстояние между первым и последним событием, и для визита
  // из одной страницы последним навсегда остаётся notBounce. Отсечки досылают служебные хиты,
  // пока вкладка на экране: без них чтение статьи неотличимо от ухода на пятнадцатой секунде.
  useEffect(() => {
    if (!id) return;
    const seen = trackEngagement({
      now: () => Date.now(),
      schedule: (run, ms) => window.setTimeout(run, ms),
      cancel: (handle) => window.clearTimeout(handle),
      hidden: () => document.hidden,
      send: alive,
    });
    const onVisibility = () => seen.visibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      seen.stop();
    };
  }, [id, path]);

  // Переходы по Link не перезагружают страницу, и счётчик их не видит: хит отправляем сами.
  // Первый хит уже сделал init, поэтому стартовый путь пропускаем.
  useEffect(() => {
    if (!id) return;
    const from = previous.current;
    previous.current = path;
    if (from === null || from === path) return;
    try {
      window.ym?.(id, "hit", window.location.href, { referer: new URL(from, window.location.origin).href });
    } catch {
      /* счётчик не должен ломать переход */
    }
  }, [id, path]);

  if (!id) return null;

  return (
    <>
      <Script id="metrika" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=${id}","ym");
ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true,ecommerce:"dataLayer"});`}
      </Script>
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${id}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
