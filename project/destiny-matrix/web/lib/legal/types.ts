import type { Lang } from "@/lib/i18n";
import type { LEGAL } from "@/lib/site";

// Правовые и справочные документы — данные, а не разметка. Раньше у каждого был свой компонент
// на язык (`TermsEn`, `PrivacyEn`, …), и язык оказывался в имени файла: десятый язык означал бы
// десятый компонент. Здесь состав документа задан структурой, одинаковой для всех языков, а
// различия — русская оферта ссылается на ГК и НК, английская таких разделов не имеет вовсе —
// выражены разным набором блоков внутри одного типа.

export type LegalField = keyof typeof LEGAL;

/** Кусок абзаца: текст и всё, что нельзя записать текстом. */
export type Chunk =
  | string
  | { b: string }
  /** Реквизит из `LEGAL`; печатается как заполняемое поле. */
  | { legal: LegalField }
  /** Почта из `LEGAL` ссылкой `mailto:`. */
  | { mail: true }
  | { link: string; text: string }
  | { out: string; text: string }
  /** Ссылка на бота поддержки: адрес собирается из `SUPPORT_BOT`. */
  | { bot: true }
  /** Цена из прайса: в документе её нельзя зашивать числом. */
  | { price: true }
  /** Кусок, который есть только в одном режиме витрины. */
  | { paid: Chunk[] }
  | { free: Chunk[] }
  /** Общая оговорка о характере материалов (`D.meta.disclaimer`). */
  | { disclaimer: true };

/** Блок печатается только в одном режиме витрины: с кассой или без неё. */
export type Only = "paid" | "free";

export type Block =
  | { h2: string; only?: Only }
  | { p: Chunk[]; only?: Only }
  | { ul: Chunk[][]; only?: Only }
  /** Объёмы работ из прайса: таблицей или списком. */
  | { tariffs: "table" | "list"; only?: Only };

export interface LegalDoc {
  h1: string;
  /** Строка под заголовком: редакция, адрес сайта, владелец. У справочных страниц её нет. */
  lead?: Chunk[];
  blocks: Block[];
}

export type LegalDocs = Record<Lang, LegalDoc>;
