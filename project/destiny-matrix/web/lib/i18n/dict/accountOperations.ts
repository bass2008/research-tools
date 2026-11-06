import type { Phrase } from "./index";

export const profileNotices = {
  verify: {
    ru: "Письмо отправлено. Подтвердите адрес по ссылке в нём.",
    en: "Check your email to confirm the address.",
  },
  email: {
    ru: "Подтвердите новый адрес по ссылке из письма. Если текущая почта подтверждена, разрешите смену и на ней.",
    en: "Check the new address for a confirmation link. If your current address is verified, approve the change there too.",
  },
  password: {
    ru: "Пароль изменён. Остальные сеансы завершены.",
    en: "Password updated. Other sessions have been signed out.",
  },
} satisfies Record<string, Phrase>;

export const operationText = {
  failed: { ru: "Не удалось выполнить операцию. Попробуйте ещё раз", en: "Please try again" },
  loadFailed: { ru: "Не удалось загрузить профиль", en: "Unable to load profile" },
  mismatch: { ru: "Пароли не совпадают", en: "Passwords do not match" },
  emailChangeHelp: {
    ru: "До подтверждения действует текущая почта. После смены нужно будет войти с новым адресом.",
    en: "Your current email remains valid until confirmation. After the change, sign in again with the new address.",
  },
  missingLink: {
    ru: "Ссылка подтверждения отсутствует. Откройте ссылку из письма.",
    en: "The confirmation link is missing. Open the link from your email.",
  },
  confirmFailed: { ru: "Не удалось подтвердить. Попробуйте ещё раз", en: "Please try again" },
} satisfies Record<string, Phrase>;

export const confirmationResults = {
  verified: { ru: "Ваша почта подтверждена.", en: "Your email is verified." },
  changed: {
    ru: "Email изменён. Войдите с новым адресом.",
    en: "Your email has been changed. Sign in using the new address.",
  },
  waiting: {
    ru: "Подтверждено. Завершите смену по ссылке, отправленной на второй адрес.",
    en: "Confirmed. Complete the confirmation using the link sent to the other address.",
  },
} satisfies Record<string, Phrase>;
