import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import AccessBadge from "./AccessBadge";

vi.mock("@/components/ui/LocaleProvider", () => ({ useLocale: () => "ru" }));

const badge = (item: Parameters<typeof AccessBadge>[0]["item"]) => renderToStaticMarkup(<AccessBadge item={item} />);

it("marks every granted access as granted", () => {
  expect(badge({ access: "granted" })).toContain("Выдана");
  expect(badge({ access: "subscription", access_until: "2027-01-07T12:00:00+00:00", access_granted: true }))
    .toMatch(/По подписке · до 07\.01\.2027<\/span><span[^>]*>Выдана</);
});

it("keeps bought and paid subscriptions unmarked", () => {
  expect(badge({ access: "forever" })).toContain("Куплена");
  expect(renderToStaticMarkup(<AccessBadge item={{ access: "forever" }} reading />)).toContain("Куплен<");
  expect(badge({ access: "subscription", access_until: "2027-01-07T12:00:00+00:00", access_granted: false }))
    .not.toContain("Выдана");
});
