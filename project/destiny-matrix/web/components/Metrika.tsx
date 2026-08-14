"use client";

import Script from "next/script";
import { useEffect } from "react";

import { metrikaId, notBounce } from "@/lib/analytics";

// Сайт одноэкранный: без notBounce отказы стабильно около 90 % и тест трафика
// ничего не измеряет. Пятнадцать секунд — порог из плана запуска.
const NOT_BOUNCE_MS = 15_000;

export default function Metrika() {
  const id = metrikaId();

  useEffect(() => {
    if (!id) return;
    const t = window.setTimeout(notBounce, NOT_BOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [id]);

  if (!id) return null;

  return (
    <>
      <Script id="metrika" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false});`}
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
