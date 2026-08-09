# webstudiolab.ru

Независимый Terraform root для постоянной инфраструктуры домена:

- лендинг из `site/` в Yandex Object Storage (объекты — `aws_s3_object` через
  провайдер `aws.storage`, потому что `yandex_storage_object` не умеет
  `cache_control`);
- публичная зона Yandex Cloud DNS;
- управляемый TLS-сертификат;
- MX на внешний форвардер ImprovMX.

Своего почтового сервера здесь нет. Приём `hello@webstudiolab.ru` и пересылку на личный
ящик делает ImprovMX: в этом root живут только MX, SPF и DMARC, а сам алиас настраивается
в их панели. Отправка от имени домена не настроена: `v=spf1 -all` и `p=reject` означают,
что за домен не отправляет никто.

## 1. Bootstrap state

```bash
tf
cd /home/sergey/Personal/research-tools/terraform/bootstrap
terraform init
terraform apply
```

## 2. Первый apply домена

```bash
cd /home/sergey/Personal/research-tools/terraform/webstudiolab.ru
source ../bootstrap/export-backend-env.sh
terraform init
terraform plan -out first.tfplan
terraform apply first.tfplan
```

По умолчанию `enable_https=false`: первый apply создаёт бакет, DNS-зону и сертификат
с validation-record, но ещё не пытается прикрепить не выпущенный сертификат к бакету.

## 3. Единственное действие в REG.RU

Заменить NS-серверы домена на:

```text
ns1.yandexcloud.net
ns2.yandexcloud.net
```

Проверка делегирования:

```bash
dig +short NS webstudiolab.ru
```

## 4. Включение HTTPS

После делегирования Certificate Manager проверит DNS автоматически. Команду проверки
сертификата печатает `terraform output certificate_status_command`. Когда статус
станет `ISSUED`:

```bash
terraform apply -var enable_https=true
```

Доступ по HTTPS открывается не мгновенно: Object Storage раскатывает сертификат
на edge-узлы до получаса. Пока идёт раскатка, часть запросов отдаёт дефолтный
`*.storage-1.yandexcloud.net`, и браузер пишет «соединение не защищено». Судить
надо по серии запросов, а не по одному.

Чтобы не передавать флаг в дальнейшем, скопируйте `terraform.tfvars.example` в
игнорируемый Git-файл `terraform.tfvars` и выставьте там `enable_https=true`.

## 5. Почта

Алиасы задаются в панели ImprovMX, кодом они не описываются: провайдера Terraform
у сервиса нет. Catch-all включать не стоит — иначе спам на любой адрес домена пойдёт
в личный ящик.

Записи, которые должны стоять в зоне (их создаёт `dns.tf`):

```text
MX   webstudiolab.ru.   10 mx1.improvmx.com.
MX   webstudiolab.ru.   20 mx2.improvmx.com.
TXT  webstudiolab.ru.   "v=spf1 include:spf.improvmx.com -all"
TXT  _dmarc...          "v=DMARC1; p=reject"
```

## 6. Проверки

```bash
./check.sh
```

Возвращает `0` при успехе и `1` при провале: сверяет NS, A, MX, SPF, DMARC, доступность
сайта по HTTPS и субъект сертификата.

Доставку письма скрипт не проверяет — отправьте письмо на `hello@webstudiolab.ru`
с любого ящика и убедитесь, что оно дошло.

## Стоимость и жизненный цикл

Постоянно тарифицируемых ресурсов в этом root нет: Object Storage, DNS и
управляемый сертификат платятся по факту, форвардер бесплатен. Этот root не зависит
от будущего `../server`, поэтому пересоздание прикладной VM не затронет сайт и DNS.
