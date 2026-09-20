#!/usr/bin/env bash
# Настоящая загрузка процессора: доля занятого времени за интервал, 0–100 % на ядро.
# Панель рисует load average — это длина очереди, а не проценты: на одном ядре она выдаёт
# «136 %», когда процессор занят наполовину.
#
#   ./cpu.sh [секунд]     по умолчанию 10
set -euo pipefail

IP="${ARCANA_PROD_IP:-45.80.130.166}"
SSH_USER="${ARCANA_SSH_USER:-root}"
WINDOW="${1:-10}"

ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" "
  nproc
  grep '^cpu ' /proc/stat
  for c in \$(docker ps --format '{{.Names}}'); do
    f=/sys/fs/cgroup/system.slice/docker-\$(docker inspect -f '{{.Id}}' \"\$c\").scope/cpu.stat
    [ -f \"\$f\" ] && echo \"C \$c \$(awk '/usage_usec/{print \$2}' \"\$f\")\"
  done
  sleep $WINDOW
  grep '^cpu ' /proc/stat
  for c in \$(docker ps --format '{{.Names}}'); do
    f=/sys/fs/cgroup/system.slice/docker-\$(docker inspect -f '{{.Id}}' \"\$c\").scope/cpu.stat
    [ -f \"\$f\" ] && echo \"D \$c \$(awk '/usage_usec/{print \$2}' \"\$f\")\"
  done
  cut -d' ' -f1-3 /proc/loadavg
" 2>/dev/null | python3 -c "
import sys
lines = [l.split() for l in sys.stdin.read().splitlines() if l.strip()]
cores = int(lines[0][0])
cpu = [l for l in lines if l[0] == 'cpu']
a = [int(x) for x in cpu[0][1:9]]
b = [int(x) for x in cpu[1][1:9]]
d = [y - x for x, y in zip(a, b)]
total = sum(d) or 1
busy = (total - d[3] - d[4]) / total * 100
before = {l[1]: int(l[2]) for l in lines if l[0] == 'C'}
after = {l[1]: int(l[2]) for l in lines if l[0] == 'D'}
load = ' '.join(lines[-1])
window = $WINDOW
print(f'процессор занят: {busy:.1f}% из 100 (ядер {cores}, простой {d[3]/total*100:.1f}%, отнято гипервизором {d[7]/total*100:.2f}%)')
print(f'load average:    {load}  — очередь процессов, не проценты')
rows = sorted(((n, (after[n] - v) / (window * 10_000)) for n, v in before.items() if n in after),
              key=lambda r: -r[1])
if rows:
    print('по контейнерам:')
    for n, pct in rows:
        print(f'  {n:<32} {pct:5.1f}%')
    print(f'  {\"— тестовые вместе\":<32} {sum(p for n, p in rows if \"test\" in n):5.1f}%')
"
