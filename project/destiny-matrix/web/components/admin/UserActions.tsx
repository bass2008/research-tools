"use client";

// Действия над чужим аккаунтом. Списком, а не рядом кнопок: их уже два, и в строке таблицы
// каждая новая кнопка съедает колонку с данными.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ApiError, api, type AdminUser } from "@/lib/api";
import { MONTHS_ACC, daysInMonth, toIso, type Sex } from "@/lib/matrix";
import { exampleDay } from "@/lib/today";

// Дата собирается тремя списками и переключателем пола — как в калькуляторе на сайте. Ввод датой
// одним полем выглядел чужеродно и на телефоне открывал системный календарь, в котором до 1970-х
// докручивать долго.
//
// Верхний год берётся из `lib/today`: собственный вызов часов в клиентском компоненте расходится
// с готовой серверной разметкой, сторож — `lib/today.test.ts` (он ищет вызов по всему файлу,
// включая комментарии).
const THIS_YEAR = exampleDay().year;
const YEARS = Array.from({ length: THIS_YEAR - 1900 + 1 }, (_, i) => THIS_YEAR - i);

export default function UserActions({ user, onGranted }: {
  user: AdminUser;
  onGranted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [granting, setGranting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(1990);
  const [sex, setSex] = useState<Sex>("f");
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // Координаты меню считаем от кнопки: список живёт в body, потому что обёртка таблицы прокручивает
  // содержимое, и внутри неё выпадашка обрезалась нижней границей — её просто не было видно.
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  // Окно уезжает в body порталом: ячейка таблицы прилипшая, а прилипшая ячейка создаёт свой
  // контекст наложения — модалка внутри неё оказывалась под кнопками соседних строк.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Клик мимо закрывает меню: без этого открытых списков в таблице набирается сколько угодно.
  // Меню вынесено в body, поэтому «мимо» — это мимо и кнопки, и самого списка.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      const target = event.target as Node;
      if (box.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.(".actions-menu")) return;
      setOpen(false);
    };
    // При прокрутке меню обязано ехать за кнопкой: оно в body и позиционируется от окна.
    // Закрывать по scroll нельзя — таблица прокручивается от самого клика, и меню закрывалось
    // в тот же миг, в который открылось.
    const follow = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setAt({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    };
    document.addEventListener("mousedown", away);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open]);

  // Escape закрывает то, что открыто: сперва окно, иначе меню. Без этого модалку приходилось
  // закрывать мышью, а привычка нажать Escape ничего не делала.
  useEffect(() => {
    if (!open && !granting) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (granting) setGranting(false);
      else setOpen(false);
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, granting]);

  const enter = async () => {
    setOpen(false);
    const ok = window.confirm(
      `Войти под ${user.email}?\n` +
        "Ваша админская сессия закроется — вернуться можно только своим входом.\n" +
        "Вход будет записан в журнал безопасности.",
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await api.admin.impersonate(user.id);
      // Полная перезагрузка, а не router.push: кука сменилась, и всё, что уже отрисовано в
      // админке, принадлежит другому человеку.
      window.location.href = "/account";
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : "Войти не удалось.");
    }
  };

  const grant = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const row = await api.admin.addMatrix(user.id, toIso({ day, month, year }), sex);
      setDone(`Матрица ${row.birth} добавлена и открыта`);
      setGranting(false);
      onGranted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить матрицу.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="actions" ref={box}>
      <button
        type="button"
        className="btn ghost sm"
        data-testid="user-actions"
        ref={trigger}
        aria-expanded={open}
        disabled={busy}
        onClick={() => {
          const rect = trigger.current?.getBoundingClientRect();
          if (rect) setAt({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
          setOpen((was) => !was);
        }}
      >
        Действия ▾
      </button>
      {open && mounted && at ? createPortal(
        <div className="actions-menu" role="menu" style={{ top: at.top, right: at.right }}>
          <button type="button" role="menuitem" data-testid="action-impersonate" onClick={enter}>
            Войти
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="action-grant"
            onClick={() => {
              setOpen(false);
              setDone(null);
              setGranting(true);
            }}
          >
            Добавить матрицу
          </button>
        </div>,
        document.body,
      ) : null}

      {granting && mounted ? createPortal(
        <div className="modal-back" onMouseDown={() => setGranting(false)}>
          <form
            className="modal"
            data-testid="grant-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={grant}
          >
            <h4>Матрица для {user.email}</h4>
            <p className="cap">Откроется сразу и без оплаты — в кабинете она будет помечена как выданная.</p>
            <div className="fields">
              <div>
                <label htmlFor="grant-d">Число</label>
                <select id="grant-d" data-testid="grant-day" value={day}
                        onChange={(e) => setDay(Number(e.target.value))}>
                  {/* дней ровно столько, сколько в выбранном месяце: 31 февраля выбрать нельзя,
                      да и список короче — в низком окне он открывался за край экрана */}
                  {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="grant-m">Месяц</label>
                <select id="grant-m" data-testid="grant-month" value={month}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setMonth(next);
                          setDay((was) => Math.min(was, daysInMonth(year, next)));
                        }}>
                  {MONTHS_ACC.map((name, i) => (
                    <option key={name} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="grant-y">Год</label>
                <select id="grant-y" data-testid="grant-year" value={year}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setYear(next);
                          setDay((was) => Math.min(was, daysInMonth(next, month)));
                        }}>
                  {YEARS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sexrow" role="group" aria-label="Пол">
              <button type="button" data-testid="grant-sex-f" data-sex="f"
                      aria-pressed={sex === "f"} className={sex === "f" ? "on" : ""}
                      onClick={() => setSex("f")}>
                Женский
              </button>
              <button type="button" data-testid="grant-sex-m" data-sex="m"
                      aria-pressed={sex === "m"} className={sex === "m" ? "on" : ""}
                      onClick={() => setSex("m")}>
                Мужской
              </button>
            </div>
            {error ? <p className="err" role="status">{error}</p> : null}
            <button type="submit" className="btn wide" disabled={busy} data-testid="grant-submit"
                    style={{ marginTop: 12 }}>
              {busy ? "Добавляем…" : "Добавить матрицу"}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setGranting(false)}>
              Отмена
            </button>
          </form>
        </div>,
        document.body,
      ) : null}

      {done ? <span className="small ok" data-testid="grant-done">{done}</span> : null}
      {error && !granting ? <span className="err small" role="status">{error}</span> : null}
    </div>
  );
}
