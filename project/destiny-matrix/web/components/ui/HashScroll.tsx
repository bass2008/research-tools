"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Переход на главную с якорем (#plans, #calc) приходит с другой страницы: Next скроллит сразу,
// а блок тарифов стоит за результатом расчёта, который дорисовывается позже — человек оставался
// наверху, в 5000 px от цены. Досматриваем якорь несколько кадров, пока элемент не появится.
export default function HashScroll() {
  const pathname = usePathname();
  const searchKey = useSearchParams().toString();

  useEffect(() => {
    let stoppedByUser = false;
    let timers: number[] = [];

    const cancel = () => {
      for (const timer of timers) window.clearTimeout(timer);
      timers = [];
    };

    const align = (force: boolean) => {
      if (stoppedByUser) return;
      const id = window.location.hash.slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      const header = document.querySelector<HTMLElement>(".site-header");
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      // После router.push оплаченный отчёт меняет высоту уже после первого scrollIntoView.
      // Повторяем выравнивание, только если target снова оказался за липкой шапкой.
      if (force || el.getBoundingClientRect().top < headerBottom - 1) {
        el.scrollIntoView({ block: "start" });
      }
    };

    const schedule = () => {
      cancel();
      stoppedByUser = false;
      // Поздние повторы нужны не для анимации, а для RSC/layout-shift оплаченного отчёта.
      timers = [0, 100, 250, 500, 1000, 2000, 3000].map((delay, index) =>
        window.setTimeout(() => align(index === 0), delay),
      );
    };

    const stop = () => {
      stoppedByUser = true;
      cancel();
    };
    const onHashChange = () => schedule();

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("pointerdown", stop, { passive: true });
    window.addEventListener("keydown", stop);
    schedule();

    return () => {
      cancel();
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [pathname, searchKey]);
  return null;
}
