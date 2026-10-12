"use client";

import { useAdminLocale } from "./useAdminLocale";

// Действия над строкой таблицы списком, а не рядом кнопок: в строке каждая новая кнопка съедает
// колонку с данными.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MenuAction = { label: string; testId: string; onSelect: () => void };

export default function ActionsMenu({ actions, busy, testId, label, className }: {
  actions: MenuAction[];
  busy?: boolean;
  testId: string;
  label?: string;
  className?: string;
}) {
  const { t } = useAdminLocale();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // Координаты меню считаем от кнопки: список живёт в body, потому что обёртка таблицы прокручивает
  // содержимое, и внутри неё выпадашка обрезалась нижней границей — её просто не было видно.
  const [at, setAt] = useState<{ top: number; left?: number; right?: number } | null>(null);
  // Кнопка в левой половине экрана — меню от её левого края, иначе от правого. Только от правого
  // оно на телефоне уходило за левый край в карточке пользователя, где кнопка стоит слева.
  const place = (rect: DOMRect) => rect.left + rect.width / 2 < window.innerWidth / 2
    ? { top: rect.bottom + 4, left: rect.left }
    : { top: rect.bottom + 4, right: window.innerWidth - rect.right };
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Клик мимо закрывает меню: без этого открытых списков в таблице набирается сколько угодно.
  // Меню вынесено в body, поэтому «мимо» — это мимо и кнопки, и самого списка.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      const target = event.target as Node;
      if (trigger.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.(".actions-menu")) return;
      setOpen(false);
    };
    // При прокрутке меню обязано ехать за кнопкой: оно в body и позиционируется от окна.
    // Закрывать по scroll нельзя — таблица прокручивается от самого клика, и меню закрывалось
    // в тот же миг, в который открылось.
    const follow = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setAt(place(rect));
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={className ?? "btn ghost sm"}
        data-testid={testId}
        ref={trigger}
        aria-expanded={open}
        disabled={busy}
        onClick={() => {
          const rect = trigger.current?.getBoundingClientRect();
          if (rect) setAt(place(rect));
          setOpen((was) => !was);
        }}
      >
        {label ?? t("Действия ▾")}</button>
      {open && mounted && at ? createPortal(
        <div className="actions-menu" role="menu" style={at}>
          {actions.map((action) => (
            <button key={action.testId} type="button" role="menuitem" data-testid={action.testId}
                    onClick={() => { setOpen(false); action.onSelect(); }}>
              {action.label}</button>
          ))}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
