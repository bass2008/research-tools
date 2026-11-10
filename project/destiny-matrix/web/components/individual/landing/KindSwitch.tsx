"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import { D } from "@/lib/i18n";
import { ONE_KINDS, type OneKind } from "./types";

/** The kinds of a single reading, the same on the offer card and in the order form. */
export default function KindSwitch({ value, onChange, p, testid }: {
  value: OneKind; onChange: (k: OneKind) => void; p: "pw" | "lp"; testid?: string;
}) {
  const L = useLocale();
  const T = D.individualSale;
  const name = { personal: T.kindPersonal[L], pair: T.kindPair[L], year: T.kindAnyYear[L] };
  // Narrow screens keep one row by hiding the second word of the child's matrix.
  const [head, ...tail] = T.childTag[L].split(" ");
  return (
    <div className="kinds-box"><div className={`${p}-kinds`}>
      {ONE_KINDS.map((k) => (
        <button key={k} type="button" className={value === k ? `${p}-on` : undefined} aria-pressed={value === k}
          onClick={() => onChange(k)} data-testid={testid ? `${testid}-${k}` : undefined}>
          {k === "child" ? <>{head}<span className="kind-tail"> {tail.join(" ")}</span></> : name[k]}
        </button>
      ))}
    </div></div>
  );
}
