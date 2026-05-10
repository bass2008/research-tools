# DevOps / Platform Engineer prep plan

Переход из Senior C# / Python Data Engineer → Senior DevOps / Platform Engineer / Go backend.

**Сильные стороны:** 10 лет программирования, 9-мес DevOps для разработки курс (Java + Go), k8s локально и в облаке, Terraform (диплом), CI/CD, Prometheus/Grafana, VPN pet-project (Terraform + Docker Compose + OIDC + reverse proxy + split routing).

**Слабые стороны:** вайб-кодинг → ширина без глубины. Плывёт в Linux internals, сети, Go production-коде.

**Цель:** закрыть пробелы за 2-3 недели вечеров до уверенного middle+, за 6 месяцев — до Senior.

---

## 1. Linux namespaces и cgroups

**Почему важно:** 90% вопросов про Docker сводятся к этому. Контейнер = namespaces (изоляция) + cgroups (лимиты) + chroot.

**Что нужно знать:**

- **Namespaces** — изолируют ресурсы между процессами:
  - `PID` — своё пространство процессов (PID 1 внутри контейнера)
  - `NET` — свой сетевой стек (интерфейсы, маршруты, iptables)
  - `MNT` — свои точки монтирования
  - `UTS` — свой hostname
  - `IPC` — свои очереди сообщений, семафоры
  - `USER` — свои UID/GID (rootless containers)
  - `CGROUP` — свой cgroup hierarchy
  - `TIME` — своё время (Linux 5.6+)

- **Cgroups v2** — лимиты ресурсов:
  - CPU (shares, quota, period)
  - Memory (limit, swap)
  - IO (throttling)
  - PIDs (max processes)
  - Network (не напрямую, через tc)

**Практика:**
```bash
# Свой namespace с новой сетью и PID
sudo unshare --net --pid --fork --mount-proc bash

# Войти в namespace существующего процесса
sudo nsenter -t <PID> -n -p bash

# Посмотреть namespaces процесса
ls -la /proc/<PID>/ns/

# Cgroups v2
systemd-cgtop
cat /sys/fs/cgroup/cgroup.controllers
```

**Как ответить на собесе "Что такое Docker?":**
> Docker — это runtime поверх Linux namespaces и cgroups. Он создаёт новые namespace'ы (PID, NET, MNT, UTS, IPC, USER) для изоляции процесса от хоста, применяет cgroup для лимитов CPU/памяти, и меняет root через pivot_root на файловую систему образа. Образ — слои файлов с copy-on-write через overlayfs. Никакой виртуализации — процесс нативно работает на ядре хоста.

**Ресурсы:**
- `man namespaces`, `man cgroups`
- https://man7.org/linux/man-pages/man7/namespaces.7.html
- "The Linux Programming Interface" — Michael Kerrisk (главы про namespaces)
- https://jvns.ca/blog/2020/04/27/new-zine--how-containers-work/

---

## 2. Сеть Linux

**Почему важно:** базовый скилл для DevOps/SRE. Без этого не поймёшь почему "не работает сеть".

**Что нужно знать:**

- **Уровень L2-L3:**
  - ARP, bridging, VLAN, MAC-таблицы
  - Routing table, default gateway, метрики маршрутов
  - NAT (SNAT vs DNAT, MASQUERADE)

- **iptables/nftables:**
  - Chains: INPUT, OUTPUT, FORWARD, PREROUTING, POSTROUTING
  - Tables: filter, nat, mangle, raw
  - `conntrack` — connection tracking
  - Зачем MASQUERADE vs SNAT

- **Network namespaces + veth:**
  - Как Docker bridge networking работает
  - veth pair = виртуальный кабель между namespace и bridge
  - docker0 bridge + iptables rules

- **Инструменты диагностики:**
  - `ip a`, `ip r`, `ip neigh`, `ip netns`
  - `ss -tlnp` (лучше netstat)
  - `tcpdump -i <iface> -nn 'port 443'`
  - `mtr` (tracerouter + ping)
  - `dig @server domain`

**Практика:**
```bash
# Создать свой network namespace
sudo ip netns add test
sudo ip netns exec test ip a

# veth pair
sudo ip link add veth0 type veth peer name veth1
sudo ip link set veth1 netns test

# Видеть что реально идёт по сети
sudo tcpdump -i docker0 -nn

# conntrack
sudo conntrack -L | head
```

**Типичные вопросы на собесах:**
1. Как работает `iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE`? → NAT на исходящий трафик через eth0, source IP меняется на IP eth0
2. Что такое conntrack и зачем? → state tracking для stateful firewall, без него нельзя было бы делать "разрешить исходящие + ответы на них"
3. Разница TCP vs UDP с точки зрения NAT? → TCP: симметричный NAT, записывается на время соединения. UDP: stateless, NAT держит запись по таймауту (30с)
4. Почему pod.example.com не резолвится внутри k8s? → DNS идёт через kube-dns/CoreDNS, проверь /etc/resolv.conf в pod'е

**Ресурсы:**
- https://wiki.archlinux.org/title/iptables (лучшая дока)
- https://www.nftables.org/projects/nftables/wiki/index.php/Main_Page
- "TCP/IP Illustrated, Volume 1" — W. Richard Stevens

---

## 3. Kubernetes глубже

**Почему важно:** все спрашивают, различие между "юзаю kubectl" и "понимаю k8s" — огромное.

**Что нужно знать (не как пользоваться, а как работает):**

- **Control plane:**
  - **API server** — единственный кто говорит с etcd
  - **etcd** — source of truth, всё состояние кластера
  - **Scheduler** — решает на какой node запустить pod (filter → score)
  - **Controller Manager** — reconciliation loops (deployment controller, replicaset controller, etc.)

- **Node components:**
  - **kubelet** — агент на каждой node, запускает pods через CRI
  - **kube-proxy** — iptables/ipvs rules для Service IP → pod IP
  - **Container runtime** (containerd, CRI-O) — через CRI (Container Runtime Interface)

- **Плагинная архитектура:**
  - **CRI** (runtime) — containerd, CRI-O
  - **CNI** (networking) — Calico, Cilium, Flannel
  - **CSI** (storage) — AWS EBS, GCE PD, ceph

- **Networking:**
  - Pod IP — уникальный в кластере
  - Service — стабильный endpoint (ClusterIP через kube-proxy)
  - Ingress — L7 routing (nginx/traefik)
  - NetworkPolicy — firewall на уровне pod'ов (требует CNI поддержки)

- **Reconciliation loop** — ключевая идея k8s:
  - Desired state (что ты хочешь) в etcd
  - Controller постоянно сравнивает с actual state
  - Делает действия чтобы уравнять
  - Ты пишешь YAML → декларация цели, не команды

**Типичные вопросы:**
1. Что происходит когда делаешь `kubectl apply -f deployment.yaml`?
   → kubectl → API server (auth, validation) → etcd (save) → deployment controller видит новое → создаёт ReplicaSet → replicaset controller создаёт pods → scheduler назначает node → kubelet на node'е запрашивает image → containerd тянет и запускает
   
2. Чем отличаются Deployment, StatefulSet, DaemonSet?
   → Deployment: stateless, rolling update, pods взаимозаменяемы. StatefulSet: stable identity (pod-0, pod-1), persistent volume claims, ordered start. DaemonSet: по одному pod на каждой node

3. Как Service находит свои pods?
   → По labels. Endpoints controller смотрит label selector Service, находит matching pods, обновляет Endpoints object. kube-proxy читает и делает iptables rules.

4. Почему pod-to-pod traffic работает через разные nodes?
   → CNI plugin настраивает overlay network (VXLAN у Flannel, BGP у Calico) или native routing. Каждая node знает подсети других.

**Практика:**
- Подними `kind` или `k3d` локально (один бинарь, минимум ресурсов)
- Создай Deployment + Service + Ingress своего приложения
- Сломай что-нибудь (убей pod, удали service) и наблюдай reconciliation
- Напиши свой простой controller на Go

**Ресурсы:**
- https://kubernetes.io/docs/concepts/ — официальная документация, читать с начала
- https://learnk8s.io/kubernetes-long-term-support — очень глубокие статьи
- https://www.oreilly.com/library/view/kubernetes-up-and/9781492046523/ — "Kubernetes: Up and Running"
- CKA/CKAD сертификация — лучший структурированный путь

---

## 4. Systemd

**Что ты уже знаешь:** базовые unit'ы, enable/start/status.

**Что стоит добавить:**

- **Типы unit'ов:**
  - `service` — обычный процесс
  - `socket` — socket activation (старт по первому подключению)
  - `timer` — замена cron
  - `mount` / `automount` — монтирование
  - `path` — реакция на изменения файлов
  - `target` — аналог runlevel
  - `slice` — cgroup-группировка

- **journald:**
  - `journalctl -u <service>` — логи сервиса
  - `journalctl -f` — follow
  - `journalctl --since "1 hour ago"`
  - `journalctl --disk-usage`
  - Persistent logs: `/etc/systemd/journald.conf` → `Storage=persistent`

- **Dependencies:**
  - `Wants=` — мягкая зависимость
  - `Requires=` — жёсткая (упал один → упал другой)
  - `After=` / `Before=` — порядок старта
  - `Conflicts=` — взаимоисключение

- **systemd-resolved:**
  - Как Linux резолвит DNS в современных дистрибутивах
  - `resolvectl status` — текущая конфигурация
  - Частая проблема: /etc/resolv.conf → systemd-resolved, локальный DNS cache

- **systemd-networkd:**
  - Альтернатива NetworkManager
  - Конфиги в `/etc/systemd/network/*.network`

**Практика:**
```bash
# Свой сервис
cat > /etc/systemd/system/myapp.service <<EOF
[Unit]
Description=My app
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/myapp
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now myapp

# Timer вместо cron
cat > /etc/systemd/system/backup.timer <<EOF
[Unit]
Description=Daily backup

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF
```

---

## 5. Go — для Platform Engineer / Senior DevOps

**Цель:** свободно читать Go-код (k8s, terraform providers, helm), писать свои тулы, контрибьютить в open-source.

### Путь изучения (2-3 недели активного времени)

**Неделя 1: основы синтаксиса**
- https://go.dev/tour — официальный интерактивный тур (3-4 часа)
- https://gobyexample.com — короткие примеры по всем темам
- Установи Go локально, делай примеры руками, не копируй

Ключевые концепты которые отличаются от C#:
- **Структуры + методы вместо классов** — нет наследования, только композиция и интерфейсы
- **Interfaces implicit** — не нужно писать `class Foo : IBar`, если методы совпадают — реализует
- **Горутины и каналы** — `go func() {}`, `ch <- value`, `<-ch` — проще чем async/await
- **Error handling через return values** — `result, err := doThing()`, нет exceptions
- **Pointers** — но без арифметики указателей как в C
- **defer** — гарантированное выполнение при выходе из функции (аналог `using`/`finally`)
- **Нет generics до Go 1.18** — сейчас есть, но используются скромно

**Неделя 2: стандартная библиотека и инструменты**
- `net/http` — HTTP server/client (на удивление простой)
- `encoding/json` — JSON marshaling через теги структур
- `context.Context` — отмена, timeouts, передача значений через call chain
- `sync` — мьютексы, WaitGroup, Once
- `io`, `bufio`, `os`, `os/exec`
- `go fmt`, `go vet`, `go test`, `golangci-lint`

**Неделя 3: реальные паттерны**
- Graceful shutdown через context
- Worker pools через channels
- Functional options pattern (очень Go-идиоматичный)
- Table-driven tests
- Mock через interfaces (не фреймворк)

### Специфика для Platform Engineer

**Что точно будешь использовать:**
- **Kubernetes client-go** — работа с k8s API из Go
- **Controller Runtime** — писать operators / controllers
- **cobra + viper** — CLI тулы (как у kubectl, helm, terraform)
- **go-yaml** — для работы с k8s манифестами
- **gRPC** — для межсервисного взаимодействия

**Подводные камни C# → Go:**
- **Нет dependency injection фреймворков** — DI через конструкторы/аргументы, вручную
- **Нет ORM как EF Core** — `sqlx` или чистый `database/sql`. Многие пишут запросы руками
- **Нет async/await** — вместо этого goroutines + channels (парадигма другая, но проще)
- **Нет исключений** — привыкнуть возвращать error везде. `if err != nil { return nil, err }` — самая частая строка
- **Nil pointer dereference** — нет nullable типов, нужно проверять вручную

### Pet-проекты для портфолио

1. **CLI тул** — что-нибудь полезное с cobra. Пример: обёртка над kubectl для частых действий
2. **HTTP API** — небольшой REST сервис с graceful shutdown, middleware, tests
3. **Kubernetes controller** — через kubebuilder или operator-sdk. Свой CRD + контроллер
4. **Exporter для Prometheus** — кастомный exporter для какой-то метрики
5. **Расширение к нашему VPN** — например Go сервис который показывает статус всех контейнеров и exit nodes

### Собесные темы

**Junior/Middle уровень:**
- Concurrency: goroutines vs threads, channels vs locks
- Slices vs arrays, что такое `append` и почему он может скопировать массив
- Maps: как работают, почему нельзя конкурентно писать без sync.Map
- Error handling patterns

**Senior уровень:**
- Context propagation через call chains
- Memory model: happens-before, race conditions
- GC tuning, escape analysis, stack vs heap
- Performance profiling: pprof, trace
- Graceful shutdown

### Ресурсы

- **Книги:**
  - "The Go Programming Language" — Donovan, Kernighan (классика)
  - "100 Go Mistakes" — Teiva Harsanyi (anti-patterns)
  - "Concurrency in Go" — Katherine Cox-Buday

- **Курсы / видео:**
  - https://www.justforfunc.com — серия видео от ex-Google
  - https://go.dev/doc/effective_go — must-read, короткая дока

- **Чтение чужого кода:**
  - https://github.com/juanfont/headscale — наш self-hosted Tailscale
  - https://github.com/prometheus/prometheus — качественный Go код
  - https://github.com/kubernetes-sigs/controller-runtime — для понимания operators

- **Практика:**
  - https://exercism.org/tracks/go — задачи с ревью
  - https://gophercises.com — мини-проекты

---

## 6. План на 6 месяцев

### Месяц 1-2: фундамент
- Go основы → свободно пишу
- Linux internals (namespaces, cgroups, systemd)
- Сеть Linux + iptables → глубже
- **Цель:** могу объяснить что такое Docker/k8s на уровне syscalls

### Месяц 3-4: Kubernetes и CI/CD
- k8s internals (controllers, reconciliation, CNI)
- Helm, kustomize
- ArgoCD / Flux (GitOps)
- Observability: Prometheus + Grafana + Loki + Tempo
- Terraform deep-dive (provider development, testing с terratest)
- **Цель:** могу развернуть production-grade k8s инфру с нуля

### Месяц 5: портфолио и подготовка
- 2-3 pet-проекта на Go
- Расширить VPN-проект: CI/CD, мониторинг, operator на Go
- Статьи на Хабре или свой блог — это сигнал для тимлидов
- Прокачать резюме и LinkedIn

### Месяц 6: собесы
- Алгоритмы (если нужно — LeetCode easy/medium, не гриндить хард)
- System design — "Designing Data-Intensive Applications" Martin Kleppmann
- Mock-интервью с pramp.com или peerlyft
- Параллельно подавать резюме

### Сертификаты (опционально, но плюс)

- **CKA / CKAD** — Kubernetes (признанный стандарт)
- **AWS Solutions Architect Associate** — если идёшь в AWS-shop
- **HashiCorp Terraform Associate** — легко, если уже знаешь Terraform

---

## 7. Стратегия на собесах

### Что говорить честно
- 10 лет программирования (сильный инженерный бэкграунд)
- C# + Python — реальный опыт
- DevOps курс + pet-проекты (показать портфолио)
- Хочешь расти в Platform Engineer / DevOps

### Что "натягивать"
- **НЕ ВРАТЬ** о месте работы ("я делал X в компании Y")
- **МОЖНО** позиционировать свои pet-проекты как production-ready опыт
- **МОЖНО** делать акцент на трансферных навыках (архитектура, дебаг, системное мышление)
- **МОЖНО** готовить "боевую" историю с текущей работы про инцидент/архитектурное решение

### Фразы для серых зон
- ❌ "Я поднимал k8s в проде"
- ✅ "В pet-проекте развернул полный стек с k8s, в прод-опыте работал с managed k8s через CI/CD"
- ❌ "Писал 3 года на Go"
- ✅ "Год изучаю Go, написал N проектов, сейчас изучаю controller-runtime"
- ❌ "Я Senior DevOps"
- ✅ "Senior Software Engineer with DevOps focus, ищу Platform Engineer роль"

### На тех. вопросе где не знаешь
- "Не сталкивался напрямую, но судя по тому что я знаю про X, подозреваю что работает через Y. Проверил бы Z"
- Это **сеньорный** паттерн — показывает рассуждение, не знание фактов

### Что не нужно
- Не надо раскрывать "я вайб-кодю" — это правда но воспринимается негативно
- Не надо извиняться за бэкграунд — твой C#/Python опыт ценный
- Не надо занижать запрашиваемую ЗП — рынок платит за Senior SWE хорошо, ты им и являешься

---

## 8. Быстрый чеклист "готов к собесу"

- [ ] Могу за 5 минут объяснить как работает Docker (namespaces + cgroups + overlayfs)
- [ ] Могу нарисовать как пакет идёт от клиента до pod в k8s (включая kube-proxy, CNI)
- [ ] Могу написать на Go простой HTTP server с graceful shutdown
- [ ] Знаю разницу между Deployment / StatefulSet / DaemonSet
- [ ] Могу объяснить CI/CD на своём pet-проекте
- [ ] Могу рассказать про свой VPN-проект как production-case
- [ ] Готова история про production-инцидент и решение
- [ ] Читал и понимаю базовый Go-код из k8s/terraform

Когда 80% галочек → готов идти на собесы.
