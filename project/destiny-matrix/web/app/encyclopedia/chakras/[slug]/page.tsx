import { permanentRedirect } from "next/navigation";
import { requestLocale } from "@/lib/i18n/request";
import { publicPath } from "@/lib/publicRouting";

// The personal chakra page was retired: the paid report prints the full reading, and printed PDFs
// still link here.
export default async function Page(): Promise<never> {
  permanentRedirect(publicPath("/encyclopedia/position/chakras", await requestLocale()));
}
