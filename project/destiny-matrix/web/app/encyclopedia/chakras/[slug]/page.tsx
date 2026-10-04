import { permanentRedirect } from "next/navigation";

// The personal chakra page was retired: the paid report prints the full reading, and printed PDFs
// still link here.
export default function Page(): never {
  permanentRedirect("/encyclopedia/position/chakras");
}
