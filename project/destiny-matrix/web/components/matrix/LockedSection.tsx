import LocalizedAnchor from "@/components/ui/LocalizedAnchor";
// Закрытый раздел: лид, карты его позиций и кнопка покупки — одна разметка для личного разбора и
// разбора пары. Номера арканов и их краткая суть бесплатны, толкования здесь нет.
import ArcanumCard from "@/components/matrix/ArcanumCard";
import { forLocale as localizedArcana } from "@/lib/arcana";
import type { Lang as Locale } from "@/lib/i18n/lang";
import { cardColumns } from "@/lib/cardColumns";
import type { ReactNode } from "react";

export interface LockedCard {
  n: number;
  who: string;
  href: string;
}

export function LockedCards({ locale: L, cards }: { locale: Locale; cards: LockedCard[] }) {
  const { arcanumShort, arcanumTitle } = localizedArcana(L);
  const gist = (n: number) => {
    const short = arcanumShort(n);
    return short.charAt(0).toLocaleUpperCase(L) + short.slice(1);
  };
  return (
    <div className="mp" style={cardColumns(cards.length)}>
      {cards.map((card, i) => (
        <LocalizedAnchor className="mpc" key={`${card.who}-${i}`} href={card.href} data-position={card.who} data-arcanum={card.n}>
          <ArcanumCard locale={L} n={card.n} size="grid" decorative />
          <span className="mpcap">
            <span className="who">{card.who}</span>
            <span className="nm"><span className="rn">{card.n}</span> {arcanumTitle(card.n)}</span>
            <span className="ds">{gist(card.n)}</span>
          </span>
        </LocalizedAnchor>
      ))}
    </div>
  );
}

export function LockedBody({ testId, lead, cta, children }: {
  testId: string;
  lead?: ReactNode;
  cta: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="body" data-testid={testId}>
      {lead ? <p className="lead">{lead}</p> : null}
      {children}
      {cta ? <p className="lockcta">{cta}</p> : null}
    </div>
  );
}
