"use client";

import { useEffect } from "react";

// Переход на главную с якорем (#plans, #calc) приходит с другой страницы: Next скроллит сразу,
// а блок тарифов стоит за результатом расчёта, который дорисовывается позже — человек оставался
// наверху, в 5000 px от цены. Досматриваем якорь несколько кадров, пока элемент не появится.
export default function HashScroll() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: "start" });
        const top = Math.abs(el.getBoundingClientRect().top);
        if (top < 200) clearInterval(timer);
      }
      if (++tries > 40) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, []);
  return null;
}
