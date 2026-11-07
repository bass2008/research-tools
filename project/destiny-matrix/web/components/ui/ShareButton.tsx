"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/ui/LocaleProvider";
import { track } from "@/lib/analytics";
import { ApiError, forLocale as localizedApi } from "@/lib/api";
import { D } from "@/lib/i18n";
import { publicPath } from "@/lib/publicRouting";

export type ShareKind = "reading" | "pair" | "individual" | "example";

const enc = encodeURIComponent;

// Brand marks from Simple Icons (CC0), drawn in the brands' own colours.
const BRAND: Record<string, [string, string]> = {
  telegram: ["#26a5e4", "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"],
  vk: ["#0077ff", "M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"],
  whatsapp: ["#25d366", "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"],
};

function BrandIcon({ name }: { name: string }) {
  const [color, d] = BRAND[name];
  return <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path d={d} fill={color} /></svg>;
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1.1 1.1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="18" cy="5.5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="18.5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function ShareButton({ kind, id = 0, label, href }: { kind: ShareKind; id?: number; label?: string; href?: string }) {
  const L = useLocale();
  const T = D.report;
  // the link belongs to the reading on screen: a new date or language on the same page must not reuse it
  const target = `${kind}:${id}:${href ?? ""}:${L}`;
  const [link, setLink] = useState<{ target: string; url: string } | null>(null);
  const url = link?.target === target ? link.url : "";
  const [open, setOpen] = useState(false);
  const shown = open && Boolean(url);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!shown) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [shown]);

  const text = label ? `${T.shareText[L][kind]} — ${label}` : T.shareText[L][kind];
  const toggle = async () => {
    if (shown) { setOpen(false); return; }
    setNote("");
    if (!url) {
      setBusy(true);
      try {
        const { api } = localizedApi(L);
        const path = href ?? publicPath(`/s/${(await (kind === "individual" ? api.shareIndividual(id) : api.shareReading(id))).token}`, L);
        setLink({ target, url: `${window.location.origin}${path}` });
      } catch (err) {
        setNote(err instanceof ApiError ? err.messageFor(L) : T.shareFailed[L]);
        return;
      } finally {
        setBusy(false);
      }
    }
    track("share_open", { place: kind });
    setOpen(true);
  };
  const sent = (network: string) => track("share_send", { place: kind, network });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(T.shareCopy[L], url);
    }
    sent("copy");
  };
  const ru = L === "ru";
  const networks: [string, string, string][] = [
    ["telegram", "Telegram", `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`],
    ["vk", ru ? "ВКонтакте" : "VK", `https://vk.com/share.php?url=${enc(url)}&title=${enc(text)}`],
    ["whatsapp", "WhatsApp", `https://wa.me/?text=${enc(`${text} ${url}`)}`],
  ];

  return (
    <span className="sharebox" ref={box}>
      <button type="button" className={busy ? "btn ghost sm sharebtn working" : "btn ghost sm sharebtn"} onClick={() => void toggle()}
        aria-expanded={shown} aria-haspopup="dialog" disabled={busy} data-testid="share-button">
        <ShareIcon />{T.share[L]}
      </button>
      {note && <span className="err" role="status" data-testid="share-error">{note}</span>}
      {shown && <div className="sharemenu" role="dialog" aria-label={T.shareTitle[L]} data-testid="share-menu" data-url={url}>
        <p className="sharemenu-h">{T.shareTitle[L]}</p>
        <div className="sharemenu-grid">
          <button type="button" data-network="copy" onClick={() => void copy()} data-testid="share-copy">
            <span className="sharemenu-ico sharemenu-link-ico" aria-hidden="true"><LinkIcon /></span>{copied ? T.shareCopied[L] : T.shareCopy[L]}
          </button>
          {networks.map(([key, name, link]) => (
            <a key={key} href={link} target="_blank" rel="noopener noreferrer"
              data-network={key} onClick={() => sent(key)}>
              <span className="sharemenu-ico"><BrandIcon name={key} /></span>{name}
            </a>
          ))}
        </div>
        <p className="sharemenu-note">{T.shareNote[L]}</p>
      </div>}
    </span>
  );
}
