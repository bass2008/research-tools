import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/components/ui/LocaleProvider", () => ({ useLocale: () => "en", useSite: () => "com" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
import AuthForm, { authDestination } from "./AuthForm";
import PasswordSetup from "./PasswordSetup";

it("keeps password login and renders no fake Google button or global script before configuration", () => {
  const html = renderToStaticMarkup(<AuthForm mode="login" locale="en" />);
  expect(html).toContain('data-testid="auth-email"'); expect(html).toContain('data-testid="auth-password"');
  expect(html).not.toContain("accounts.google.com"); expect(html).not.toContain('data-testid="google-sign-in"');
});
it.each([
  ["?order=arcana-12-abcdef12", false, "/pay/done?order=arcana-12-abcdef12"],
  ["?reading=42", false, "/matrix/individual/42"],
  ["?reading=42&order=arcana-12-abcdef12", true, "/account/delete"],
  ["?return=account-delete", false, "/account/delete"],
  ["?reading=https://evil.example&return=https://evil.example", false, "/account"],
  ["?order=arcana-12-abcdef12%26redirect%3Dhttps://evil.example", false, "/account"],
] as const)("preserves the safe post-login destination (%s)", (search, deletion, expected) => {
  expect(authDestination(search, deletion)).toBe(expected);
});
it.each(["ru", "en"] as const)("offers Google-only users the existing email password setup flow (%s)", locale => {
  const html = renderToStaticMarkup(<PasswordSetup email="person@example.test" locale={locale} />);
  expect(html).toContain('data-testid="password-setup"');
  expect(html).toContain(locale === "en" ? "Email a password setup link" : "Получить ссылку для установки пароля");
  expect(html).not.toContain('type="password"');
});
