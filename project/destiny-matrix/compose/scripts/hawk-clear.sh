export HAWK_EMAIL='Zendor2008@mail.ru' HAWK_PASSWORD='…'
python compose/scripts/hawk-clear.py "acrana-sense.ru test"                    # показать список
python compose/scripts/hawk-clear.py "acrana-sense.ru test" --match FormCheck  # только заголовки с FormCheck
python compose/scripts/hawk-clear.py "acrana-sense.ru test" --apply            # удалить всё
