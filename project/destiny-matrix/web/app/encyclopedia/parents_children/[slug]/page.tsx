import { personalReadingMetadata, personalReadingPage } from "../../_personal/reading";

// Раздел зашит в путь: общий `[section]/[slug]` перехватывал любой неизвестный адрес под
// `/encyclopedia/` и отдавал 404 без разметки. Список маршрутов сверяется тестом.
export const dynamic = "force-dynamic";

export const generateMetadata = personalReadingMetadata("parents_children");
export default personalReadingPage("parents_children");
