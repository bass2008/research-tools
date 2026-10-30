import Link from "@/components/ui/LocalizedLink";
import { Fragment } from "react";

const BOLD = /(\*\*[^*]+\*\*)/g;
const LINKS = /(\[[^\]]+\]\(\/[^)\s]*\))/g;
const ONE_LINK = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/;

function links(text: string) {
  return text.split(LINKS).map((part, i) => {
    const link = ONE_LINK.exec(part);
    return link ? <Link key={i} href={link[2]} prefetch={false}>{link[1]}</Link> : part;
  });
}

// «29,1 %»: знак не должен уходить на следующую строку от числа
const PERCENT = /(\d) %/g;

export default function RichText({ text }: { text: string }) {
  return text.replace(PERCENT, "$1\u00a0%").split(BOLD).map((part, i) => part.startsWith("**")
    ? <strong key={i}>{links(part.slice(2, -2))}</strong>
    : <Fragment key={i}>{links(part)}</Fragment>);
}
