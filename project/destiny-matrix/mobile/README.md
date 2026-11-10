# Arcana Sense — Android

Expo 58 / React Native 0.88. Единая тема «Ателье», русский и английский интерфейс.

Пять вкладок: **Сегодня**, **Матрица**, **Пара**, **Знания**, **Кабинет**. Приложение помнит
дату рождения, показывает интерактивную схему и главы разбора. В «Сегодня» — тема дня,
месяц и год; доступны карточки для отправки, Android-виджет и ежедневное напоминание.
Пара и прогноз года подставляют вашу дату. В кабинете — сохранённые разборы, покупки и PDF.
Язык и личная дата меняются в настройках.

Расчёт, карты и тема дня встроены. Статьи и личные тексты загружаются с сервера;
платный корпус в APK не включён. Российская и неизвестная страна магазина скрывают покупку.

## Поставить на телефон

APK: `/home/sergey/Samba/apk/arcana-sense.apk`, release `mobile@0.2.0-phone`,
ARM64 и x86_64. Подписан прежним тестовым ключом `android/app/debug.keystore`.
Откройте файл на Android и разрешите установку из выбранного файлового приложения.
При обновлении поверх прежней версии данные сохраняются; Metro и Google Play для запуска не нужны.

```bash
source ~/Android/env.sh
adb -s <серийный-номер-телефона> install -r /home/sergey/Samba/apk/arcana-sense.apk
```

Для статей, аккаунта и покупок телефон и компьютер должны быть в одной сети.
Сервер этой сборки: `http://192.168.0.95:3000`. Проверить связь можно, открыв
`http://192.168.0.95:3000/en` в браузере телефона. Адрес меняется в настройках,
в блоке «Локальная проверка»; это завершает сессию.

Покупки локальные, без списаний: в настройках выберите тестовую страну **US**,
откройте закрытую главу, создайте тестовый аккаунт и отдельно подтвердите покупку.
**RU** оставляет бесплатное чтение и уже приобретённые разборы. Серверный аккаунт общий с сайтом.
Google OAuth и реальные покупки Google Play требуют отдельной настройки:
[Google Sign-In](../docs/google-sign-in.md), [Billing](../docs/mobile-backend.md).

## Разработка

Из `mobile/`, с уже работающим сервером на 3000/8018:

```bash
source ~/Android/env.sh
npm ci
ARCANA_MOBILE_LOCAL=1 EXPO_PUBLIC_API_BASE=http://192.168.0.95:3000 \
  SENTRY_DISABLE_AUTO_UPLOAD=true CI=1 CMAKE_BUILD_PARALLEL_LEVEL=2 \
  npx expo run:android --device emulator-5554 --no-bundler
ARCANA_MOBILE_LOCAL=1 EXPO_PUBLIC_API_BASE=http://192.168.0.95:3000 \
  npx expo start --dev-client --port 8081
```

В другом терминале:

```bash
source ~/Android/env.sh
adb -s emulator-5554 reverse tcp:8081 tcp:8081
adb -s emulator-5554 shell am start -a android.intent.action.VIEW \
  -d 'exp+arcana-sense://?__expo_url=http%3A%2F%2F127.0.0.1%3A8081&__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1'
```

После установки dev-client изменения JS подхватывает Metro. Нативные зависимости ставятся
через `npx expo install`, затем dev-client нужно пересобрать. `android/` генерируется Expo;
нативная конфигурация живёт в `app.config.ts` и `plugins/`.

Окружение: JDK 17, Android SDK `platforms;android-37.0`, build-tools 37.0.0,
NDK 27.1.12297006, CMake 3.22.1. Команды текущего стенда: [dev.json](../out/mobile-redesign/dev.json).

## Автономная локальная сборка

Из `mobile/`:

```bash
source ~/Android/env.sh
export ARCANA_MOBILE_LOCAL=1
export EXPO_PUBLIC_API_BASE=http://192.168.0.95:3000
export ARCANA_MOBILE_RELEASE=mobile@0.2.0-phone
# Public DSN существующего тестового проекта.
export EXPO_PUBLIC_ERRORS_DSN=$(python -c 'import json; from pathlib import Path; print(json.loads(Path("../compose/docker-compose.test.yml").read_text().splitlines()[1].strip())[0]["errorsDsn"])')
CI=1 npx expo prebuild --platform android --no-install
cd android
SENTRY_DISABLE_AUTO_UPLOAD=true CI=1 NODE_ENV=production CMAKE_BUILD_PARALLEL_LEVEL=2 \
  ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=2 --console=plain
```

Результат: `android/app/build/outputs/apk/release/app-release.apk`.
Сохраните существующий `android/app/debug.keystore`: другой ключ не позволит обновить приложение.
Локальный HTTP разрешается только при `ARCANA_MOBILE_LOCAL=1`. Это тестовая сборка,
публикация в магазине — отдельный этап.

## Проверки

```bash
npm run typecheck
npm run lint
npm test
source ~/Android/env.sh
maestro test --device emulator-5554 \
  -e DEV_CLIENT=0 -e LANG=ru -e EMAIL=buyer-unique@example.com \
  --test-output-dir ../out/mobile-redesign/task-05/maestro flows/buyer.yaml
```

`buyer.yaml` очищает приложение и проходит первый запуск, точки, бесплатную и закрытую главу,
регистрацию и US mock-покупку, полный текст, «Сегодня», тему, отправку карточки, пару, год,
знания, кабинет и смену языка. Для каждого запуска нужна новая тестовая почта.
Для EN передайте `LANG=en`, для dev-client — `DEV_CLIENT=1`: предварительно выполните `pm clear` и откройте Metro
командой `adb shell am start` из раздела разработки. Этот режим пропускает запуск оболочки Expo.
Части сценария находятся в `flows/parts/`; старые сценарии удалённых экранов убраны.
Остальные сценарии аккаунта и ошибок требуют своих фикстур и не входят в путь покупателя.

Эмуляторы: `pixel` — Android 15; `miui12` — Android 12 Google APIs, это не прошивка MIUI.
Для 360 dp: `adb shell wm size 1080x2400`, `adb shell wm density 480`;
для шрифта 130%: `adb shell settings put system font_scale 1.3`. После изменения — холодный запуск.
Вернуть: `wm size reset`, `wm density reset`, `settings put system font_scale 1.0`.

Отчёт покупателя, результаты и финальные снимки: [task-05](../out/mobile-redesign/task-05/).
