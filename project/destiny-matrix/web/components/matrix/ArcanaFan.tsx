import { arcanumImage } from "@/components/matrix/ArcanumCard";

export default function ArcanaFan({ cards, size = "md", className }: { cards: readonly number[]; size?: "sm" | "md"; className?: string }) {
  return (
    <div className={`afan afan-${size}${className ? ` ${className}` : ""}`} aria-hidden="true">
      {cards.slice(0, 3).map((n, i) => <img key={`${i}-${n}`} src={arcanumImage(n, true)} alt="" loading="lazy" />)}
    </div>
  );
}
