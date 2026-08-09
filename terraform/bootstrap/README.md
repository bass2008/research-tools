# Bootstrap: удалённый Terraform state

Этот root создаёт только инфраструктуру для state: сервисный аккаунт, статический
S3-ключ и versioned-бакет. Сайт и почта здесь намеренно отсутствуют.

## Первый запуск

```bash
tf
cd /home/sergey/Personal/research-tools/terraform/bootstrap
terraform init
terraform plan
terraform apply
```

State bootstrap остаётся локальным. Его нельзя удалять, пока существуют root-проекты,
использующие созданный бакет.

## Подключение другого root-проекта

```bash
cd /home/sergey/Personal/research-tools/terraform/webstudiolab.ru
source ../bootstrap/export-backend-env.sh
terraform init
```

Скрипт ничего не печатает из ключей и экспортирует их только в текущий shell.
