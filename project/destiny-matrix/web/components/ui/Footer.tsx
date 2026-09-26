import { requestSite } from "@/lib/siteProfile.server";
import type { Lang } from "@/lib/i18n/lang";
import FooterContent from "./FooterContent";

export { forLocale } from "./FooterContent";

export default async function Footer(props: { plain?: boolean; locale?: Lang }) {
  return <FooterContent {...props} site={await requestSite()} />;
}
