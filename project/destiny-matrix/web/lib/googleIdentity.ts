import type { GoogleAuthChallenge } from "./api";
import type { Lang } from "./i18n/lang";

export interface GoogleCredential { credential: string }
export interface GoogleIdentity {
  initialize(options: { client_id: string; nonce: string; callback: (response: GoogleCredential) => void;
    auto_select: false; ux_mode: "popup" }): void;
  renderButton(element: HTMLElement, options: { type: "standard"; theme: "outline"; size: "large";
    text: "signin_with" | "signup_with"; shape: "rectangular"; locale: Lang }): void;
}

export function googleIdentity(): GoogleIdentity | undefined {
  return (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
}

/** GIS owns its branded button and popup; there is no custom OAuth button or One Tap. */
export function renderGoogleButton(identity: GoogleIdentity, element: HTMLElement, challenge: GoogleAuthChallenge,
  locale: Lang, mode: "login" | "register", callback: (response: GoogleCredential) => void) {
  identity.initialize({ client_id: challenge.client_id, nonce: challenge.nonce, callback, auto_select: false, ux_mode: "popup" });
  identity.renderButton(element, { type: "standard", theme: "outline", size: "large",
    text: mode === "register" ? "signup_with" : "signin_with", shape: "rectangular", locale });
}
