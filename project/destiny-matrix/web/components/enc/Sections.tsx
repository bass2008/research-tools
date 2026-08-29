import type { Section } from "@/lib/content";

export default function Sections({ items }: { items: Section[] }) {
  if (!items.length) return null;
  return (
    <div className="prose section-gap">
      {items.map((s) => (
        <section key={s.h2}>
          <h2>{s.h2}</h2>
          {s.paragraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </section>
      ))}
    </div>
  );
}
