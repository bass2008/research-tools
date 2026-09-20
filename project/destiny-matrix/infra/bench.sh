#!/usr/bin/env bash
# Одинаковый замер для любой машины: запускается и на нынешней, и на кандидате, числа сравниваются
# строка к строке. Без установки пакетов — только то, что есть в базовой Ubuntu.
#
#   ssh root@<машина> 'bash -s' < infra/bench.sh          # всё сразу
#   ssh root@<машина> 'bash -s cpu' < infra/bench.sh      # по частям: cpu | disk | net
#
# Осторожно: занимает диск на ~1 ГБ во время прогона и держит оба ядра под полной нагрузкой около
# трёх минут. На боевой машине запускать в тихие часы.
set -u

PART=${1:-all}
WORK=${WORK:-/tmp/bench.$$}
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

say() { printf '\n== %s\n' "$1"; }
val() { printf '%-42s %s\n' "$1" "$2"; }

if [ "$PART" = all ] || [ "$PART" = info ]; then
say "машина"
val "процессор" "$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | xargs)"
val "ядер" "$(nproc)"
val "память, МБ" "$(free -m | awk '/^Mem:/{print $2}')"
val "диск" "$(df -h --output=size,used,avail / | tail -1 | xargs)"
val "аптайм" "$(uptime -p 2>/dev/null || uptime)"

fi

if [ "$PART" = all ] || [ "$PART" = cpu ]; then
say "CPU: короткий рывок (что показывает витрина)"
val "AES-256-CBC, 16 КБ блок, МБ/с" \
    "$(openssl speed -elapsed -seconds 2 aes-256-cbc 2>/dev/null | awk '/^aes-256-cbc/{printf "%.0f", $NF/1024}')"
START=$(date +%s.%N)
python3 -c 's=0
for i in range(8_000_000): s+=i*i' 2>/dev/null
val "счётный цикл, 1 поток, с (меньше — лучше)" "$(echo "$(date +%s.%N) $START" | awk '{printf "%.2f", $1-$2}')"

say "CPU: длительная нагрузка — здесь виден burstable"
# Главный тест для машин с гарантированной долей ядра: первые секунды идут на кредитах, дальше
# провайдер режет до оплаченной доли. Короткий замер этого не показывает вовсе.
for i in $(seq 1 "$(nproc)"); do
  ( python3 -c 'import time
end = time.time() + 180
n = 0
while time.time() < end:
    for _ in range(200000): n += 1
    print(int(time.time()), n, flush=True)' > "$WORK/load.$i" 2>/dev/null ) &
done
wait
python3 - "$WORK" <<'PY'
import glob, sys
rows = {}
for name in glob.glob(f"{sys.argv[1]}/load.*"):
    prev_t = prev_n = None
    for line in open(name):
        t, n = map(int, line.split())
        if prev_t is not None and t > prev_t:
            rows.setdefault(t, 0)
            rows[t] += (n - prev_n) / (t - prev_t)
        prev_t, prev_n = t, n
if rows:
    order = sorted(rows)
    first = sum(rows[t] for t in order[:10]) / 10
    last = sum(rows[t] for t in order[-10:]) / 10
    print(f'{"операций/с в первые 10 с":42} {first/1e6:.1f} млн')
    print(f'{"операций/с в последние 10 с":42} {last/1e6:.1f} млн')
    print(f'{"падение под нагрузкой":42} {100 - last * 100 / first:.0f}%')
PY

fi

if [ "$PART" = all ] || [ "$PART" = disk ]; then
say "диск"
val "последовательная запись 1 ГБ, МБ/с" \
    "$(dd if=/dev/zero of="$WORK/seq" bs=1M count=1024 conv=fdatasync 2>&1 | awk '/copied/{print $(NF-1)}')"
sync; sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches' 2>/dev/null || true
val "последовательное чтение, МБ/с" \
    "$(dd if="$WORK/seq" of=/dev/null bs=1M 2>&1 | awk '/copied/{print $(NF-1)}')"
SYNC=$(dd if=/dev/zero of="$WORK/sync" bs=4k count=2000 oflag=dsync 2>&1 | awk '/copied/{print $(NF-3)}')
val "синхронная запись 4 КБ, IOPS" "$(echo "$SYNC" | awk '{printf "%.0f", 2000/$1}')"
val "создание 2000 мелких файлов, с" \
    "$( { TIMEFORMAT=%R; time ( mkdir -p "$WORK/many"; for i in $(seq 1 2000); do echo x > "$WORK/many/$i"; done; sync ); } 2>&1 | tail -1)"

fi

if [ "$PART" = all ] || [ "$PART" = net ]; then
say "сеть"
val "пинг до Москвы (77.88.8.8), мс" \
    "$(ping -c 5 -q 77.88.8.8 2>/dev/null | awk -F'/' '/rtt|round-trip/{printf "%.1f", $5}')"
val "скачивание 100 МБ с зеркала, МБ/с" \
    "$(curl -s -o /dev/null -w '%{speed_download}' --max-time 60 http://mirror.yandex.ru/ubuntu/ls-lR.gz 2>/dev/null | awk '{printf "%.1f", $1/1048576}')"

say "доступность внешних сервисов (для бота и хранилищ)"
for host in api.telegram.org storage.yandexcloud.net s3.ru-1.storage.selcloud.ru cdnjs.cloudflare.com; do
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "https://$host/" 2>/dev/null)
  val "$host" "${code:-нет ответа}"
done

fi

say "итог"
