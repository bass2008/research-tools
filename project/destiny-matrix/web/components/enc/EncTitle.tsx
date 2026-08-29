"use client";

import { usePathname } from "next/navigation";

// Надпись справочника видна на всех страницах каркаса, но заголовком первого уровня она
// остаётся только на самой /encyclopedia: у детальных страниц свой h1.
export default function EncTitle() {
  const path = usePathname();
  const text = "Энциклопедия матрицы судьбы";
  if (path === "/encyclopedia") return <h1 className="enc-title">{text}</h1>;
  return (
    <div className="enc-title enc-title-sub" aria-hidden="true">
      {text}
    </div>
  );
}
