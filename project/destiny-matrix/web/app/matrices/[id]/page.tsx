import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ReportSheet from "@/components/ReportSheet";
import { calculate } from "@/lib/matrix";
import { build } from "@/lib/sections";
import { pageMeta } from "@/lib/site";
import { getTariffs } from "@/lib/tariffs";

import {
  pickMatrix,
  planLabel,
  readAccess,
  readMatrixUnlocked,
  readSavedMatrices,
} from "../../_lib/access";

// Сохранённая матрица: дата рождения и разбор печатаются на запрос и только владельцу куки.
// Ни предрендера, ни кеша — иначе чужая дата рождения (специальная категория ПД) осела бы в
// готовом HTML или в кеше прокси.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Сохранённая матрица",
  description: "Разбор сохранённой матрицы: октаграмма, позиции карты и разделы вашего тарифа.",
  path: "/matrices",
  noindex: true,
});

export default async function SavedMatrixPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await readAccess();

  if (!access.authenticated) {
    return (
      <Sheet>
        <div className="panel narrow">
          <h3>Нужен вход</h3>
          <p className="dim">
            {access.offline
              ? "Сервер не ответил, поэтому доступ не подтверждён. Обновите страницу."
              : "Сохранённые матрицы открываются только владельцу аккаунта: дата рождения не отдаётся никому, кроме него."}
          </p>
          <Link className="btn wide" href="/login">
            Войти
          </Link>
          <p className="hint">
            Считать матрицу без регистрации можно и так — <Link href="/#calc">расчёт в браузере</Link>.
          </p>
        </div>
      </Sheet>
    );
  }

  const saved = await readSavedMatrices();
  const chosen = pickMatrix(saved, id);
  if (!chosen) notFound();

  let matrix;
  try {
    matrix = calculate(chosen.birth, chosen.sex);
  } catch {
    notFound();
  }

  const unlocked = await readMatrixUnlocked(chosen.id);
  return (
    <Sheet>
      <ReportSheet
        matrix={matrix}
        sections={build(matrix, unlocked)}
        planName={planLabel(access, await getTariffs(), unlocked)}
        saved={saved}
        currentId={chosen.id}
      />
    </Sheet>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <div className="wrap">
        {children}
        <p className="small center" style={{ marginTop: 18 }}>
          <Link href="/account">Кабинет</Link> · <Link href="/report">Мой разбор</Link>
        </p>
      </div>
    </main>
  );
}
