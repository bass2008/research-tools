import { afterEach, expect, it, vi } from "vitest";
import { forLocale } from "./api";
import { renderGoogleButton, type GoogleIdentity } from "./googleIdentity";

afterEach(() => vi.unstubAllGlobals());
it.each(["ru", "en"] as const)("renders the official localized button with the exact server nonce (%s)", locale => {
  const identity: GoogleIdentity = { initialize: vi.fn(), renderButton: vi.fn() };
  const element = {} as HTMLElement, callback = vi.fn();
  renderGoogleButton(identity, element, { client_id: "client-id", challenge: "server-challenge", nonce: "server-nonce" }, locale, "login", callback);
  expect(identity.initialize).toHaveBeenCalledExactlyOnceWith({ client_id: "client-id", nonce: "server-nonce", callback, auto_select: false, ux_mode: "popup" });
  expect(identity.renderButton).toHaveBeenCalledWith(element, expect.objectContaining({ type: "standard", locale, text: "signin_with" }));
  // Rendering or cancelling a popup is not authentication. Only a received credential calls back.
  expect(callback).not.toHaveBeenCalled();
});
it("keeps link-required machine code and sends a password retry as a JSON POST, never a URL", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ detail: "Confirm password", code: "google_link_required" }, { status: 409 }))
    .mockResolvedValueOnce(Response.json({ authenticated: true, user: { id: 5, has_password: true } }));
  vi.stubGlobal("fetch", fetcher);
  const api = forLocale("en").api;
  await expect(api.googleLogin("id-token-secret", "one-use-challenge")).rejects.toMatchObject({ status: 409, code: "google_link_required" });
  await expect(api.googleLogin("id-token-secret", "one-use-challenge", "current-password")).resolves.toMatchObject({ authenticated: true });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1][0]).toBe("/api/auth/google");
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ credential: "id-token-secret", challenge: "one-use-challenge", current_password: "current-password" });
});
it("does not automatically replay a one-use login after a network failure", async () => {
  const fetcher = vi.fn(async () => { throw new Error("Offline"); }); vi.stubGlobal("fetch", fetcher);
  await expect(forLocale("en").api.googleLogin("credential", "challenge")).rejects.toMatchObject({ status: 0 });
  expect(fetcher).toHaveBeenCalledOnce();
});
