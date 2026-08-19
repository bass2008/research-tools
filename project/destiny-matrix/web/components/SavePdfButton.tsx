"use client";

/**
 * Сохранение разбора в PDF. Печатью браузера, а не сборкой файла на клиенте: в диалоге печати
 * есть «Сохранить как PDF», текст остаётся текстом (его можно искать и копировать), а карты
 * печатаются теми же картинками. Библиотека-конвертер дала бы растр и лишние 200 КБ бандла.
 *
 * Разделы разбора живут в <details>; перед печатью их надо раскрыть, иначе в файл попадут одни
 * заголовки. После печати вернуть как было — печать не должна менять страницу.
 */
export default function SavePdfButton({ label = "Сохранить как PDF" }: { label?: string }) {
  const print = () => {
    const closed = [...document.querySelectorAll<HTMLDetailsElement>("details:not([open])")];
    closed.forEach((el) => (el.open = true));
    const restore = () => {
      closed.forEach((el) => (el.open = false));
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    // дать браузеру перерисовать раскрытые разделы до снимка страницы
    requestAnimationFrame(() => window.print());
  };

  return (
    <button type="button" className="btn ghost sm pdfbtn" data-testid="save-pdf" onClick={print}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        {/* дискета: корпус, шторка и наклейка */}
        <path
          d="M4 3.5h11.2L20.5 8.8V20a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M7.8 3.5h7.4v5H7.8z" fill="currentColor" />
        <path d="M7 13h10v7.5H7z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9.4 15.4h5.2M9.4 17.6h3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {label}
    </button>
  );
}
