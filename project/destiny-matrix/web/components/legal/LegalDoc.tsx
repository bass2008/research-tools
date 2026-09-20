import { Fragment } from "react";
import Link from "next/link";

import Crumbs from "@/components/ui/Crumbs";
import Price from "@/components/pay/Price";
import TariffScope from "@/components/legal/TariffScope";
import { ALL_FREE } from "@/lib/access";
import { D, L } from "@/lib/i18n";
import type { Block, Chunk, LegalDoc } from "@/lib/legal/types";
import { DISCLAIMER, LEGAL, SUPPORT_BOT } from "@/lib/site";
import type { Tariff } from "@/lib/tariffs";

function Piece({ chunk }: { chunk: Chunk }) {
  if (typeof chunk === "string") return <>{chunk}</>;
  if ("b" in chunk) return <b>{chunk.b}</b>;
  if ("legal" in chunk) return <span className="placeholder">{LEGAL[chunk.legal]}</span>;
  if ("mail" in chunk) return <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;
  if ("link" in chunk) return <Link href={chunk.link}>{chunk.text}</Link>;
  if ("out" in chunk) return <a href={chunk.out} target="_blank" rel="noopener">{chunk.text}</a>;
  if ("bot" in chunk) {
    return (
      <a href={`https://t.me/${SUPPORT_BOT}`} target="_blank" rel="noopener">@{SUPPORT_BOT}</a>
    );
  }
  if ("price" in chunk) return <Price />;
  if ("paid" in chunk) return ALL_FREE ? null : <Line chunks={chunk.paid} />;
  if ("free" in chunk) return ALL_FREE ? <Line chunks={chunk.free} /> : null;
  return <>{DISCLAIMER}</>;
}

function Line({ chunks }: { chunks: Chunk[] }) {
  return (
    <>
      {chunks.map((chunk, i) => (
        <Fragment key={i}>
          <Piece chunk={chunk} />
        </Fragment>
      ))}
    </>
  );
}

function shown(block: Block): boolean {
  if (!block.only) return true;
  return block.only === (ALL_FREE ? "free" : "paid");
}

export default function LegalDocView(
  { doc, crumb, tariffs = [] }: { doc: LegalDoc; crumb: string; tariffs?: Tariff[] },
) {
  return (
    <main id="content" className="page">
      <div className="wrap prose">
        <Crumbs trail={[{ name: D.nav.home[L], path: "/" }, { name: crumb }]} />
        <h1>{doc.h1}</h1>
        {doc.lead ? <p className="updated"><Line chunks={doc.lead} /></p> : null}
        {doc.blocks.filter(shown).map((block, i) => {
          if ("h2" in block) return <h2 key={i}>{block.h2}</h2>;
          if ("p" in block) return <p key={i}><Line chunks={block.p} /></p>;
          if ("ul" in block) {
            return (
              <ul key={i}>
                {block.ul.map((item, j) => <li key={j}><Line chunks={item} /></li>)}
              </ul>
            );
          }
          return <TariffScope key={i} as={block.tariffs} tariffs={tariffs} />;
        })}
      </div>
    </main>
  );
}
