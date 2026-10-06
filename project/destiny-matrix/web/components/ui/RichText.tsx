import Link from "next/link";
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

export default function RichText({ text }: { text: string }) {
  return text.split(BOLD).map((part, i) => part.startsWith("**")
    ? <strong key={i}>{links(part.slice(2, -2))}</strong>
    : <Fragment key={i}>{links(part)}</Fragment>);
}
