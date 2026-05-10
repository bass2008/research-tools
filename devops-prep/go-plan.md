# Go: Middle → Senior plan

План изучения Go для C# разработчика с 10-летним опытом. Цель — за 3 месяца стать уверенным middle, за 6 — подготовиться к Senior-собесам.

---

## Уровни компетенции

| Уровень | Что умеешь |
|---------|-----------|
| **Junior** | Синтаксис, стандартная библиотека, простой HTTP-сервер |
| **Middle** | Concurrency (goroutines + channels), context, error handling, работа с БД, тесты, HTTP API, модули, профайлинг |
| **Senior** | Memory model, escape analysis, pprof/trace для оптимизации, архитектура приложений, distributed systems patterns, контрибуции в open-source, менторинг |

---

## Месяц 1: основы + переход от C# мышления

### Неделя 1: синтаксис и базовая стандартная библиотека

**Ресурсы:**
- https://go.dev/tour — официальный интерактивный тур (3-4 часа)
- https://gobyexample.com — короткие примеры по темам

**Ключевые темы:**

**1. Типы данных:**
- `int`, `int32`, `int64`, `uint`, `float64` — размер имеет значение
- Строки — immutable, байты, руны (`rune` = `int32`, unicode code point)
- Массивы fixed size vs slices (это разные типы!)
- Maps — hash tables, не упорядочены
- Structs — value types как в C#, но без классов

**2. Функции:**
- Multiple return values — идиома для error: `result, err := fn()`
- Named returns — `func fn() (result int, err error)`
- Variadic — `func sum(nums ...int)`
- Closures — замыкания первоклассные

**3. Указатели:**
- `&x` — взять адрес, `*p` — разыменовать
- Нет арифметики указателей как в C
- `new(T)` vs `&T{}` — обычно второе

**4. Error handling (отличается от C#):**
```go
// ❌ Так было бы в C#
try {
    result = DoThing();
} catch (Exception ex) {
    HandleError(ex);
}

// ✅ В Go
result, err := DoThing()
if err != nil {
    return fmt.Errorf("failed to do thing: %w", err)
}
```

Разница от C#:
- Нет try/catch — паника только для действительно фатальных ошибок
- `errors.Is()` и `errors.As()` — как `is T` и `as T` в C#
- `fmt.Errorf("... %w", err)` — обёртка ошибки с сохранением цепочки

### Неделя 2: структуры, интерфейсы, методы

**Методы:**
```go
type User struct {
    Name string
    Age  int
}

// Value receiver — копия
func (u User) Greet() string {
    return "Hi, " + u.Name
}

// Pointer receiver — можно менять поля
func (u *User) SetAge(age int) {
    u.Age = age
}
```

Правила receiver'ов:
- Меняет state → pointer receiver
- Структура большая → pointer receiver (избежать копирования)
- Консистентность — если один метод с `*`, все должны быть с `*`

**Интерфейсы (это главное отличие от C#):**
```go
// В Go не пишешь "implements IReader"
type Reader interface {
    Read(p []byte) (n int, err error)
}

// Любой тип с методом Read автоматически реализует Reader
type MyReader struct{}
func (r MyReader) Read(p []byte) (n int, err error) { ... }
// Всё! MyReader теперь Reader
```

Это называется **structural typing** или **duck typing**. Плюсы:
- Не нужно менять чужой код чтобы применить свой интерфейс
- Лучше для тестирования (mock — любая структура с нужными методами)
- Empty interface `interface{}` (или `any` в Go 1.18+) = `object` в C#

**Композиция вместо наследования:**
```go
type Animal struct {
    Name string
}
func (a Animal) Greet() string { return "Hi, " + a.Name }

type Dog struct {
    Animal  // embedding, не наследование
    Breed string
}

// Dog.Greet() работает автоматически через embedded Animal
d := Dog{Animal: Animal{Name: "Rex"}, Breed: "Husky"}
d.Greet() // "Hi, Rex"
```

### Неделя 3: concurrency — главная сила Go

**Goroutines:**
```go
go func() {
    fmt.Println("async work")
}()
// Продолжает выполняться не дожидаясь
```

- Goroutine ~= "легковесный thread" — 2KB стек вместо 1MB у OS thread
- Можно запустить миллион goroutines без проблем
- Планировщик Go сам распределяет их по OS threads (M:N модель)
- Нет `await` — синхронизация через channels или `sync`

**Channels:**
```go
ch := make(chan int)      // unbuffered — отправка блокирует пока кто-то не прочитает
buf := make(chan int, 10) // buffered — 10 элементов без блокировки

ch <- 42                  // отправить
value := <-ch             // получить
close(ch)                 // закрыть (нельзя писать после)
```

**Select:**
```go
select {
case msg := <-ch1:
    fmt.Println(msg)
case <-time.After(5*time.Second):
    fmt.Println("timeout")
case <-ctx.Done():
    return
}
```

**Паттерны concurrency:**
```go
// Worker pool
jobs := make(chan Job, 100)
results := make(chan Result, 100)
for i := 0; i < 10; i++ {
    go worker(jobs, results)
}

// Fan-out / fan-in
// Pipeline: source → stage1 → stage2 → sink
// WaitGroup для ожидания всех goroutines
```

**sync пакет:**
- `sync.Mutex` / `sync.RWMutex` — мьютексы
- `sync.WaitGroup` — ждать завершения N goroutines
- `sync.Once` — выполнить один раз (для инициализации)
- `sync.Map` — конкурентная map (но обычная map + Mutex часто быстрее)
- `atomic` — atomic операции

**Правило №1 concurrency в Go:**
> Don't communicate by sharing memory; share memory by communicating.
> (Не шарь память — общайся через каналы)

### Неделя 4: context и стандартные паттерны

**context.Context — обязательно освоить:**
```go
// Отмена через cancel
ctx, cancel := context.WithCancel(context.Background())
defer cancel()

// Таймаут
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

// Передача через вызовы
func doWork(ctx context.Context) error {
    select {
    case <-ctx.Done():
        return ctx.Err()  // context cancelled или deadline exceeded
    case result := <-doHeavyWork():
        return nil
    }
}
```

`context.Context` — первый аргумент функций по соглашению:
```go
func FetchUser(ctx context.Context, id string) (*User, error)
```

**defer — как `using`/`finally`:**
```go
f, err := os.Open("file.txt")
if err != nil {
    return err
}
defer f.Close()  // выполнится при выходе из функции
```

**Typical HTTP handler:**
```go
func handler(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    
    user, err := fetchUser(ctx, r.URL.Query().Get("id"))
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    if err := json.NewEncoder(w).Encode(user); err != nil {
        log.Printf("encode: %v", err)
    }
}
```

---

## Месяц 2: production Go

### Неделя 5-6: HTTP API + БД

**HTTP server с правильной структурой:**
```go
type Server struct {
    db     *sql.DB
    logger *slog.Logger
}

func (s *Server) routes() http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /users/{id}", s.handleGetUser)
    mux.HandleFunc("POST /users", s.handleCreateUser)
    return s.loggingMiddleware(mux)
}

func (s *Server) Run(ctx context.Context) error {
    srv := &http.Server{
        Addr:    ":8080",
        Handler: s.routes(),
    }
    
    // Graceful shutdown
    go func() {
        <-ctx.Done()
        shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        srv.Shutdown(shutdownCtx)
    }()
    
    return srv.ListenAndServe()
}
```

**БД — `database/sql` или `sqlx` или `sqlc`:**
```go
// Чистый database/sql (многословно, но явно)
rows, err := db.QueryContext(ctx, "SELECT id, name FROM users WHERE age > $1", 18)
if err != nil {
    return err
}
defer rows.Close()

var users []User
for rows.Next() {
    var u User
    if err := rows.Scan(&u.ID, &u.Name); err != nil {
        return err
    }
    users = append(users, u)
}
```

Альтернативы:
- **sqlx** — добавляет `StructScan`, меньше boilerplate
- **sqlc** — генерирует типобезопасный код из SQL-файлов (топовый выбор 2024)
- **GORM** — ORM как EF Core, но Go-комьюнити его не любит
- **ent** (от Facebook) — современный ORM

### Неделя 7: тестирование

**Table-driven tests — Go-идиома:**
```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive", 2, 3, 5},
        {"negative", -1, -2, -3},
        {"zero", 0, 0, 0},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Add(tt.a, tt.b)
            if got != tt.expected {
                t.Errorf("got %d, want %d", got, tt.expected)
            }
        })
    }
}
```

**Mocking — через интерфейсы без фреймворков:**
```go
type UserRepository interface {
    FindByID(ctx context.Context, id string) (*User, error)
}

// В прод
type PostgresUserRepo struct { db *sql.DB }

// В тестах
type MockUserRepo struct {
    users map[string]*User
}
func (m *MockUserRepo) FindByID(_ context.Context, id string) (*User, error) {
    return m.users[id], nil
}
```

**testify** — популярная библиотека с assertions:
```go
import "github.com/stretchr/testify/assert"

func TestUser(t *testing.T) {
    u := NewUser("Sergey")
    assert.Equal(t, "Sergey", u.Name)
    assert.NotNil(t, u.ID)
}
```

**Benchmarks:**
```go
func BenchmarkFoo(b *testing.B) {
    for i := 0; i < b.N; i++ {
        Foo()
    }
}
// go test -bench=. -benchmem
```

### Неделя 8: модули, структура проекта, инструментарий

**Стандартная структура проекта:**
```
myapp/
├── go.mod              # как package.json
├── go.sum              # как package-lock.json
├── cmd/
│   └── server/
│       └── main.go     # точка входа
├── internal/           # код доступен только этому модулю
│   ├── api/
│   ├── storage/
│   └── service/
├── pkg/                # публичные пакеты (если кто-то импортирует)
└── Dockerfile
```

`internal/` — особая директория: Go-компилятор запрещает импорт из других модулей. Аналог `internal` в C#.

**Инструменты:**
- `go fmt` — форматирование (обязательно, Go-комьюнити не принимает неформатированный код)
- `go vet` — статический анализатор (лишние переменные, подозрительный код)
- `golangci-lint` — мета-линтер, объединяет ~50 линтеров. Стандарт индустрии
- `go test ./...` — тесты
- `go test -race` — race detector, находит data races во время тестов
- `go mod tidy` — чистит неиспользуемые зависимости

**Make-файл типичного Go-проекта:**
```makefile
.PHONY: build test lint

build:
	go build -o bin/server ./cmd/server

test:
	go test -race -cover ./...

lint:
	golangci-lint run

run:
	go run ./cmd/server
```

---

## Месяц 3: senior-уровень

### Неделя 9-10: performance + internals

**Профилирование:**
```go
import _ "net/http/pprof"

// Endpoint /debug/pprof/ автоматически доступен
// go tool pprof http://localhost:8080/debug/pprof/heap
// go tool pprof http://localhost:8080/debug/pprof/profile?seconds=30
```

Виды профилей:
- **CPU** — где тратится время
- **Heap** — что аллоцирует память
- **Goroutine** — сколько goroutines, где заблокированы
- **Block** — где блокируются на mutex/channel
- **Mutex** — contention на мьютексах

**Escape analysis — где выделяется память:**
```go
// Stack allocation — быстро
func stack() int {
    x := 42
    return x  // x на стеке
}

// Heap allocation — медленнее (GC)
func heap() *int {
    x := 42
    return &x  // x "убежал" на heap, потому что pointer возвращается
}

// Проверить: go build -gcflags='-m' ./...
```

Senior должен понимать когда код аллоцирует память и уметь это оптимизировать.

**GC tuning:**
- `GOGC=100` (default) — GC запускается когда heap удвоился
- `GOGC=off` — отключить (не делай в проде)
- `GOMEMLIMIT` (Go 1.19+) — мягкий лимит памяти

### Неделя 11: memory model + race conditions

**Go memory model — happens-before:**
- Операции в одной goroutine упорядочены
- Между goroutines порядок не гарантирован **без синхронизации**
- Синхронизация: channels, sync.Mutex, sync/atomic

**Race condition пример:**
```go
// ❌ BROKEN
counter := 0
for i := 0; i < 1000; i++ {
    go func() { counter++ }()  // data race!
}

// ✅ Fixed with mutex
var mu sync.Mutex
for i := 0; i < 1000; i++ {
    go func() {
        mu.Lock()
        counter++
        mu.Unlock()
    }()
}

// ✅ Or with atomic
var counter int64
for i := 0; i < 1000; i++ {
    go func() { atomic.AddInt64(&counter, 1) }()
}
```

Всегда тестируй с `-race`:
```bash
go test -race ./...
go run -race main.go
```

### Неделя 12: архитектура больших приложений

**Dependency Injection в Go:**

Нет встроенного DI-фреймворка как в C#. Паттерны:

1. **Ручной wiring в main.go** — самый популярный:
```go
func main() {
    db, _ := sql.Open("postgres", dsn)
    userRepo := storage.NewUserRepo(db)
    userService := service.NewUserService(userRepo)
    handler := api.NewHandler(userService)
    http.ListenAndServe(":8080", handler)
}
```

2. **wire (Google)** — генерирует код DI во время компиляции
3. **fx (Uber)** — реальный DI container с графом зависимостей

Для приложения на пару сервисов — ручной wiring лучше. Для больших — fx/wire.

**Clean Architecture / Hexagonal:**
```
internal/
├── domain/          # сущности, бизнес-правила (ничего не импортирует)
├── service/         # бизнес-логика (зависит от domain)
├── storage/         # БД адаптеры (зависит от domain)
├── api/             # HTTP handlers (зависит от service)
```

Правило: зависимости идут внутрь, не наружу. domain ничего не знает про БД и HTTP.

**Functional Options Pattern** — Go-идиома:
```go
type Server struct {
    port    int
    timeout time.Duration
    logger  Logger
}

type Option func(*Server)

func WithPort(p int) Option {
    return func(s *Server) { s.port = p }
}

func WithTimeout(t time.Duration) Option {
    return func(s *Server) { s.timeout = t }
}

func NewServer(opts ...Option) *Server {
    s := &Server{port: 8080, timeout: 30*time.Second}
    for _, opt := range opts {
        opt(s)
    }
    return s
}

// Использование
srv := NewServer(WithPort(9090), WithTimeout(60*time.Second))
```

---

## Темы на собесе

### Middle уровень

**Concurrency:**
1. Чем goroutine отличается от thread? → Легковесный, 2KB стек, планируется Go runtime'ом, M:N модель
2. Buffered vs unbuffered channel?
3. Что такое `select`? Что делает `default` в нём?
4. Что такое data race? Как обнаружить?
5. Когда использовать Mutex vs Channel?

**Слайсы:**
1. Разница между array и slice?
2. Что делает `append`? Когда может скопировать underlying array?
3. `len` vs `cap`?
4. Как передать slice чтобы изменения были видны вызывающему?

**Maps:**
1. Можно ли конкурентно читать map? (да, если нет записей)
2. Что такое sync.Map, когда её использовать?
3. Почему итерация по map не упорядочена?

**Error handling:**
1. Разница `errors.Is` и `errors.As`?
2. Что делает `fmt.Errorf("%w", err)`?
3. Когда использовать panic?

### Senior уровень

**Runtime:**
1. Как работает Go scheduler? Что такое GMP (Goroutine-Machine-Processor)?
2. Что такое preemption в Go? Когда goroutine переключается?
3. Как работает GC? Generational / non-generational?
4. Что такое escape analysis?

**Memory:**
1. Разница stack vs heap allocation в Go?
2. Как pprof использовать для поиска memory leak?
3. Что такое `sync.Pool` и когда нужен?

**System design на Go:**
1. Спроектировать rate limiter (token bucket, leaky bucket)
2. Graceful shutdown HTTP-сервера с долгими запросами
3. Worker pool с ограниченной памятью
4. Pub/sub система с каналами

---

## Как преподнести свой опыт C# на собесах

**Играет в твою пользу:**
- 10 лет инженерной практики — ты знаешь как писать production код
- C# → Go — естественный переход, многие компании это приветствуют
- Твой VPN pet-проект — не мало кода, senior-тема

**Вопросы на собесе где твой C# опыт поможет:**
- Архитектура, паттерны — language-agnostic
- Production debugging — одно и то же везде
- Testing strategies — то же самое
- Code review skills — то же самое

**Где Go отличается от C# и это стоит упомянуть:**
- "В Go error handling явный через return values, в отличие от exceptions в C#"
- "В Go composition вместо inheritance, duck typing интерфейсов"
- "Goroutines проще mental model чем async/await — меньше magic"

**Что говорить про опыт Go:**
- Не завышай — 3-6 месяцев self-study + pet-проекты
- Покажи код на GitHub — это сильнее любых слов
- Упомяни чтение исходников известных проектов (headscale, prometheus) — показывает интерес

---

## Pet-проекты для портфолио

**Уровень middle (делать по одному в неделю):**

1. **URL shortener** с HTTP API и SQLite
2. **Key-value store** с TTL через goroutines
3. **Chat server** через WebSockets
4. **CLI тул** с cobra — обёртка над чем-то

**Уровень senior (по одному в месяц):**

1. **Rate limiter middleware** — token bucket с распределённым lock через Redis
2. **Distributed job queue** — RabbitMQ/NATS/Kafka + workers
3. **Prometheus exporter** — собирать кастомные метрики
4. **Kubernetes operator** — через kubebuilder, управлять CRD
5. **Mini TCP load balancer** — round-robin, health checks

---

## Чтение чужого кода (важно для senior!)

Выбери один проект и прочитай его исходники:

**Начальный уровень (простая кодовая база):**
- https://github.com/spf13/cobra — CLI framework
- https://github.com/gin-gonic/gin — HTTP framework

**Средний:**
- https://github.com/juanfont/headscale — наш VPN координатор
- https://github.com/prometheus/prometheus

**Продвинутый:**
- https://github.com/kubernetes-sigs/controller-runtime
- https://github.com/golang/go — stdlib (пакеты net/http, sync, context)

Задачи при чтении:
1. Пройтись по main.go, понять структуру
2. Выбрать одну фичу, разобрать полностью (какие функции вызываются)
3. Найти одну неидеальную часть, подумать как улучшить
4. На собесе упомянуть: "читал исходники X, понял что..."

---

## Книги (по приоритету)

**Обязательно:**
1. **"The Go Programming Language"** — Donovan, Kernighan. Классика, короткая, полная
2. **"100 Go Mistakes and How to Avoid Them"** — Teiva Harsanyi. Шикарная книга про anti-patterns

**Когда станет интересно:**
3. **"Concurrency in Go"** — Katherine Cox-Buday. Глубокое погружение в goroutines/channels
4. **"Let's Go"** + **"Let's Go Further"** — Alex Edwards. Практичная, про веб-приложения
5. **"Ultimate Go Notebook"** — William Kennedy. Philosophy of Go, mechanical sympathy

**Для senior:**
6. **"System Design Interview"** — Alex Xu. Не про Go, но нужно для FAANG-собесов
7. **"Designing Data-Intensive Applications"** — Martin Kleppmann. Bible distributed systems

---

## Timeline для собесов

**Через 3 месяца:** готов на middle Go roles
- Знаешь синтаксис и concurrency
- Можешь написать HTTP API с БД и тестами
- Есть 2-3 pet-проекта на GitHub

**Через 6 месяцев:** готов на senior Go roles
- Понимаешь runtime и memory model
- Умеешь профилировать и оптимизировать
- Есть production-quality pet-проект (твой VPN + кастомный Go сервис)
- Читал исходники известных проектов
- Можешь архитектурные вопросы

**Стратегия:**
- Месяц 1-2: учёба, не подаёшь резюме
- Месяц 3: подаёшь на middle Go roles — практика собесов
- Месяц 4-5: продолжаешь учиться, параллельно собесы
- Месяц 6: целишься в senior roles

Лучшие компании для перехода:
- Продуктовые со своей инфрой (Авито, Озон, Яндекс)
- Финтех (Tinkoff, Raiffeisen) — много Go
- Инфра-компании (Cloudru, Kolla, Selectel)
- Стартапы — охотно берут сильных разработчиков без Go-опыта

---

## Быстрый чеклист готовности

### Middle:
- [ ] Понимаю разницу slice vs array
- [ ] Могу написать HTTP API с graceful shutdown
- [ ] Использовал goroutines + channels в реальной задаче
- [ ] Писал table-driven tests
- [ ] Понимаю error wrapping (`%w`, errors.Is, errors.As)
- [ ] Использовал context.Context
- [ ] Написал как минимум 2 pet-проекта

### Senior:
- [ ] Понимаю GMP scheduler
- [ ] Профилировал через pprof и оптимизировал
- [ ] Понимаю escape analysis
- [ ] Проектировал архитектуру с Clean Architecture / Hexagonal
- [ ] Читал и понимаю код kubelet или аналогичного
- [ ] Написал production-ready pet-проект (не todo-app)
- [ ] Могу спроектировать distributed system на собесе
