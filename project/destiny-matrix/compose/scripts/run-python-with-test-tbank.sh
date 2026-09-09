#!/usr/bin/env bash
# То же, что run-python.sh, но платежи идут через тестовый терминал банка, а не через мок:
# видно настоящую форму оплаты, чек и все статусы. Ключи берутся из ~/.config/arcana/tbank.env.
set -euo pipefail
cd "$(dirname "$0")"

KEYS=~/.config/arcana/tbank.env
[ -f "$KEYS" ] || { echo "нет $KEYS — без ключей терминала платить нечем"; exit 1; }
set -a; . "$KEYS"; set +a

# Защита от чужих денег: локально допустим только тестовый терминал. С боевым ключом каждая
# покупка в прогоне списывала бы настоящие 250 рублей.
case "${TBANK_TERMINAL_KEY:-}" in
  *DEMO) : ;;
  *) echo "в $KEYS не тестовый терминал (${TBANK_TERMINAL_KEY:-пусто}) — локально так нельзя"; exit 1 ;;
esac

export PAYMENT_PROVIDER=tbank

cat <<INFO
== платежи через тестовый терминал $TBANK_TERMINAL_KEY
   карты: docs/t-bank-test-ac.md
   уведомления банка на localhost не доходят — доступ открывается по возврату на /pay/done
   браузерные тесты на этом стенде не гонять: они начнут создавать платежи в банке
INFO

exec ./run-python.sh
