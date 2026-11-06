"use client";
import { useLocale } from "@/components/ui/LocaleProvider";
import { useSession } from "@/components/account/useSession";
import Link from "@/components/ui/LocalizedLink";
import SaveMatrixButton from "./SaveMatrixButton";
import { forLocale } from "./MatrixResult";
import type { Sex } from "@/lib/matrix";

export default function SaveReadingSummary({ birth, sex, opened, total, savedId }: {
  birth: string; sex: Sex; opened: number; total: number; savedId?: number | null;
}) {
  const L = useLocale(), en = L === "en";
  const session = useSession();
  const date = forLocale(L).birthLabel(birth);
  return <section className="save-reading-summary">
    <div><h2>{en ? "Personal matrix" : "Личная матрица"} · {date}</h2>
      <p>{date} · {en ? `${opened} of ${total} sections open` : `открыто ${opened} из ${total} разделов`}</p></div>
    {session.status === "user" && (savedId ?
      <Link className="btn ghost sm" href={`/matrices/${savedId}`}>{en ? "Saved in your account" : "Сохранено в кабинете"} →</Link> :
      <SaveMatrixButton key={`${birth}:${sex}`} birth={birth} sex={sex} label={en ? "Save to account" : "Сохранить в кабинет"} />)}
  </section>;
}
