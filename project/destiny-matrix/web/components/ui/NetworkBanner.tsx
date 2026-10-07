"use client";

import { useSyncExternalStore } from "react";

import { D } from "@/lib/i18n";
import { networkSnapshot, serverNetworkSnapshot, subscribeNetwork } from "@/lib/netwatch";
import { useLocale } from "./LocaleProvider";

export default function NetworkBanner() {
  const L = useLocale();
  const state = useSyncExternalStore(subscribeNetwork, networkSnapshot, serverNetworkSnapshot);
  if (!state.retrying) return null;
  return (
    <div className="net-banner" role="status" aria-live="polite" data-testid="net-banner">
      {state.online ? D.networkBanner.retrying[L] : D.networkBanner.offline[L]}
    </div>
  );
}
