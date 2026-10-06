// Internal link in body text: `[text](/path)`; the build checks that the path exists.
export const LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;

export function plainText(text: string): string {
  return text.replace(LINK, "$1").replace(/\*\*/g, "");
}
