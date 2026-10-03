export default function RichText({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**")
    ? <strong key={i}>{part.slice(2, -2)}</strong>
    : part);
}
