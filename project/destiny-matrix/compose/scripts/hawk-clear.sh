# Логин аккаунта Hawk лежит вне репозитория: ~/.config/arcana/hawk.env (HAWK_EMAIL, HAWK_PASSWORD).
set -a; . ~/.config/arcana/hawk.env; set +a
python compose/scripts/hawk-clear.py "acrana-sense.ru test"                    # показать список
python compose/scripts/hawk-clear.py "acrana-sense.ru test" --match FormCheck  # только заголовки с FormCheck
python compose/scripts/hawk-clear.py "acrana-sense.ru test" --apply            # удалить всё
