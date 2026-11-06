"use client";

import { useEffect, useId, useState } from "react";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ApiError, forLocale, type AdminUser } from "@/lib/api";
import { Pagination } from "@/components/account/Notifications";

export default function RegisteredUserPicker({ value, onChange, disabled }: {
  value: number | null; onChange: (id: number | null) => void; disabled: boolean;
}) {
  const L = useLocale(), en = L === "en";
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [label, setLabel] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AdminUser[]; total: number; page_size: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setLoading(true); setError(""); setActive(-1);
    const timer = setTimeout(() => {
      forLocale(L).api.admin.users(page, 20, "email", "asc", search).then(result => {
        if (live) setData(result);
      }).catch(e => {
        if (live) setError(e instanceof ApiError ? e.messageFor(L) : en ? "Unable to load users" : "Не удалось загрузить пользователей");
      }).finally(() => { if (live) setLoading(false); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [L, en, search, page]);
  function choose(user: AdminUser) {
    onChange(user.id); setLabel(`${user.email} · #${user.id}`); setOpen(false);
  }
  const items = !loading && !error ? data?.items ?? [] : [];
  return <div className="registered-user-picker" onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  }}>
    <label>{en ? "User" : "Пользователь"}
      <input role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        placeholder={en ? "Search by email or ID" : "Поиск по email или ID"}
        autoComplete="off" value={value ? label : search} disabled={disabled}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
        onChange={e => { setSearch(e.target.value); setPage(1); onChange(null); setOpen(true); setActive(-1); setLoading(true); }}
        onKeyDown={e => {
          if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); setOpen(true);
            setActive(i => Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))));
          }
          if (e.key === "Enter" && open) { e.preventDefault(); if (items[active]) choose(items[active]); }
        }} />
    </label>
    {open && <div className="registered-user-menu">
      <div id={listId} role="listbox" aria-label={en ? "Registered users" : "Зарегистрированные пользователи"}>
        {items.map((user, i) => <button type="button" role="option" id={`${listId}-${i}`} key={user.id}
          aria-selected={value === user.id} className={active === i ? "active" : ""}
          onMouseDown={e => e.preventDefault()} onClick={() => choose(user)}>
          {user.email}<small>#{user.id}</small>
        </button>)}
      </div>
      {loading && <p className="small" role="status">{en ? "Loading…" : "Загружаем…"}</p>}
      {error && <p className="err" role="alert">{error}</p>}
      {!loading && !error && data?.total === 0 && <p className="small">{en ? "No registered users found" : "Зарегистрированные пользователи не найдены"}</p>}
      {data && <Pagination page={page} total={data.total} size={data.page_size} disabled={disabled || loading} onChange={next => { setPage(next); setLoading(true); }} />}
    </div>}
  </div>;
}
