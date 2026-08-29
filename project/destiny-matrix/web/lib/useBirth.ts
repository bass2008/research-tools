"use client";

import { useSyncExternalStore } from "react";

import { BIRTH_EVENT, loadBirth, type StoredBirth } from "./storage";

/**
 * Дата рождения из браузера — одним способом на весь сайт.
 *
 * Раньше её читали пять компонентов, и каждый по-своему: кто-то один раз при монтировании,
 * кто-то ещё и по `focus`, кто-то не перечитывал вовсе. Отсюда шли расхождения: платёж уходил
 * за прежнюю дату, «Мой разбор» показывал не то, что калькулятор, а справочник печатал отчёт
 * по дате, которой на экране уже не было.
 */

let snapshot: StoredBirth | null = null;
let raw = "";

function read(): StoredBirth | null {
  const stored = loadBirth();
  // useSyncExternalStore сравнивает снимки по ссылке: без кеша каждый рендер получал бы
  // новый объект и уходил в бесконечный цикл
  const key = stored ? `${stored.birth}|${stored.sex}` : "";
  if (key !== raw) {
    raw = key;
    snapshot = stored;
  }
  return snapshot;
}

function subscribe(onChange: () => void): () => void {
  const events: Array<[EventTarget, string]> = [
    [window, BIRTH_EVENT],
    [window, "focus"],
    [window, "pageshow"],
    [document, "visibilitychange"],
  ];
  for (const [target, name] of events) target.addEventListener(name, onChange);
  return () => {
    for (const [target, name] of events) target.removeEventListener(name, onChange);
  };
}

export function useBirth(): StoredBirth | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
