#!/usr/bin/env bash
# Разложить конфигурацию nginx на машину. Источник правды — каталог infra/nginx, а не сервер:
# правки руками через ssh теряются при пересоздании машины и не видны в истории.
#
# Скрипт идемпотентен: заливает файлы, проверяет конфиг, перезагружает. При ошибке возвращает
# прежние файлы из бэкапа и завершается с ненулевым кодом — сайт не остаётся со сломанным nginx.
set -euo pipefail
cd "$(dirname "$0")"

IP=${IP:-84.201.157.100}
STAMP=$(date '+%Y%m%d-%H%M%S')

echo "== отправка на $IP"
scp -q -o StrictHostKeyChecking=accept-new \
  nginx/arcana.conf nginx/arcana-test.conf \
  nginx/conf.d/arcana-tuning.conf nginx/conf.d/arcana-filters.conf \
  nginx/snippets/arcana-filters.inc \
  "ubuntu@$IP:/tmp/"

# Пароль тестового домена на машине остаётся: в репозиторий он не попадает. Файл создаётся один
# раз, дальше не перезаписывается — иначе каждый деплой менял бы креды.
ssh -o StrictHostKeyChecking=accept-new "ubuntu@$IP" "sudo bash -s" <<REMOTE
set -euo pipefail
BACKUP=/etc/nginx/backup-$STAMP
mkdir -p "\$BACKUP" /etc/nginx/snippets
for f in sites-available/arcana.conf sites-available/arcana-test.conf \
         conf.d/arcana-tuning.conf conf.d/arcana-filters.conf snippets/arcana-filters.inc; do
    [ -f "/etc/nginx/\$f" ] && install -D "/etc/nginx/\$f" "\$BACKUP/\$f" || true
done

install -m 644 /tmp/arcana.conf            /etc/nginx/sites-available/arcana.conf
install -m 644 /tmp/arcana-test.conf       /etc/nginx/sites-available/arcana-test.conf
install -m 644 /tmp/arcana-tuning.conf     /etc/nginx/conf.d/arcana-tuning.conf
install -m 644 /tmp/arcana-filters.conf    /etc/nginx/conf.d/arcana-filters.conf
install -m 644 /tmp/arcana-filters.inc     /etc/nginx/snippets/arcana-filters.inc
ln -sf /etc/nginx/sites-available/arcana.conf      /etc/nginx/sites-enabled/arcana.conf
ln -sf /etc/nginx/sites-available/arcana-test.conf /etc/nginx/sites-enabled/arcana-test.conf

if ! nginx -t; then
    echo "== конфиг не прошёл проверку, возвращаю прежний"
    cp -a "\$BACKUP"/. /etc/nginx/
    nginx -t
    exit 1
fi
systemctl reload nginx
echo "== nginx перезагружен, бэкап в \$BACKUP"
REMOTE

# Пароль тестового домена скрипт не создаёт: он секрет и живёт вне репозитория. Если файла на
# машине нет, тестовый домен окажется открытым — предупреждаем явно.
ssh "ubuntu@$IP" "test -f /etc/nginx/.htpasswd-test" \
  || echo "!! на машине нет /etc/nginx/.htpasswd-test — тест открыт; поднимите bootstrap-machine.sh"

echo "== проверка"
for u in "https://arcana-sense.ru/" "https://arcana-sense.ru/robots.txt"; do
  printf '  %-42s %s\n' "$u" "$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$u")"
done
printf '  %-42s %s\n' "тест без пароля (ожидается 401)" \
  "$(curl -s -o /dev/null -m 15 -w '%{http_code}' https://test.arcana-sense.ru/)"
printf '  %-42s %s\n' "ловушка сканера (ожидается 000)" \
  "$(curl -s -o /dev/null -m 15 -w '%{http_code}' https://arcana-sense.ru/wp-admin/install.php || true)"
echo "готово"
