"""Адреса соседей в compose обязаны разрешаться в сети того же контура.

23.09.2026 боевой русский контур печатал ноль отчётов: сервисы переименовали в `ru-*`, а
`BROWSER_URL` остался `http://browser:3001`. Имя `browser` живёт алиасом только в сети печати,
куда ходят соседние контуры, — свой api в неё не подключён и получал `Name or service not known`.
Покупатель заплатил и не увидел файла, задачи печати падали одна за другой.

Проверка статическая: она читает те же файлы, что едут на машину, и не требует поднятого стенда.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit

import pytest
import yaml

COMPOSE = Path(__file__).resolve().parents[2] / "compose"
FILES = sorted(COMPOSE.glob("docker-compose*.yml"))
# Адреса соседей по внутренней сети. Наружные (`SITE_URL`) проверять нечем: они уходят в интернет.
NEIGHBOURS = ("BROWSER_URL", "WEB_INTERNAL_URL", "API_INTERNAL_URL")


class ComposeLoader(yaml.SafeLoader):
    pass


# `ports: !override [...]` — метка слияния для compose, значение под ней обычное.
ComposeLoader.add_multi_constructor(
    "!", lambda loader, suffix, node: loader.construct_object(node.__class__(
        tag=f"tag:yaml.org,2002:{'seq' if isinstance(node, yaml.SequenceNode) else 'map'}",
        value=node.value), deep=True)
    if isinstance(node, (yaml.SequenceNode, yaml.MappingNode)) else node.value,
)


def load(path: Path) -> dict:
    return yaml.load(path.read_text(), Loader=ComposeLoader) or {}


def networks_of(service: dict) -> set[str]:
    declared = service.get("networks")
    if not declared:
        return {"default"}
    return set(declared) if isinstance(declared, (dict, list)) else {str(declared)}


def names_in(service_name: str, service: dict) -> dict[str, set[str]]:
    """Под какими именами сервис виден в каждой своей сети."""
    declared = service.get("networks")
    out: dict[str, set[str]] = {}
    for net in networks_of(service):
        extra = set()
        if isinstance(declared, dict):
            extra = set((declared.get(net) or {}).get("aliases") or [])
        out[net] = {service_name} | extra
    return out


def external_name(compose: dict, net: str) -> str | None:
    """Имя сети вне compose: по нему контуры разных проектов встречаются в одной сети."""
    spec = (compose.get("networks") or {}).get(net) or {}
    return spec.get("name") if spec.get("external") else None


def shared_aliases() -> dict[str, set[str]]:
    """Все имена, объявленные во внешних сетях, — по всем файлам разом."""
    out: dict[str, set[str]] = {}
    for path in FILES:
        compose = load(path)
        for name, service in (compose.get("services") or {}).items():
            for net, aliases in names_in(name, service).items():
                shared = external_name(compose, net)
                if shared:
                    out.setdefault(shared, set()).update(aliases)
    return out


def hosts(service: dict) -> list[tuple[str, str]]:
    env = service.get("environment") or {}
    if isinstance(env, list):
        env = dict(item.split("=", 1) for item in env if "=" in item)
    found = []
    for key in NEIGHBOURS:
        raw = str(env.get(key, ""))
        if not raw:
            continue
        # значение приходит как `${BROWSER_URL:-http://browser:3001}`: нужен адрес по умолчанию
        default = raw.split(":-", 1)[1].rstrip("}") if ":-" in raw else raw.strip("${}")
        host = urlsplit(default).hostname
        if host and host not in ("127.0.0.1", "localhost", "host.docker.internal"):
            found.append((key, host))
    return found


# Локальные раскладки: общий стенд и dev-надстройка живут на машине разработчика и с боевыми
# контурами в одной сети не оказываются. Сравнивать их имена с машинными нельзя — сеть печати
# там своя, одноимённая.
LOCAL = {"docker-compose.full.yml", "docker-compose.override.yml"}


def printer_of(compose: dict, services: dict) -> tuple[str, dict] | None:
    """Сервис, который открывает страницы для печати: его ищут по адресу из `BROWSER_URL`."""
    wanted = {host for service in services.values()
              for key, host in hosts(service) if key == "BROWSER_URL"}
    for name, service in services.items():
        if wanted & set().union(*names_in(name, service).values()):
            return name, service
    return None


def test_printed_page_belongs_to_the_contour_that_asked_for_it():
    """Страницу для печати открывает браузер, и разрешает имя он — значит имя должно быть
    однозначным именно для него.

    23.09.2026 боевой русский сайт печатал отчёты с тестового. Контуры переименовали в `ru-*`,
    браузер остался в двух сетях сразу, и имя `ru-web` стало вести к двум фронтам: своему — по
    внутренней сети, тестовому — по сети печати. Побеждал тестовый; он про матрицу покупателя не
    знал и отдавал 404, а человек получал PDF со страницей «Такой страницы нет» вместо разбора.
    """
    outside: dict[tuple[str, str], set[str]] = {}
    for path in FILES:
        compose = load(path)
        for name, service in (compose.get("services") or {}).items():
            for net, aliases in names_in(name, service).items():
                shared = external_name(compose, net)
                if shared and path.name not in LOCAL:
                    for alias in aliases:
                        outside.setdefault((shared, alias), set()).add(f"{path.name}:{name}")

    for path in FILES:
        if path.name in LOCAL:
            continue
        compose = load(path)
        services = compose.get("services") or {}
        # У соседних контуров своего браузера нет — они печатают общим. Тогда проверить, что
        # увидит браузер, по этому файлу нельзя, но остальные адреса проверяются как обычно.
        printer = printer_of(compose, services)
        printer_name = printer[0] if printer else None
        printer_nets = networks_of(printer[1]) if printer else None

        for name, service in services.items():
            for key, host in hosts(service):
                # По `WEB_INTERNAL_URL` ходит браузер, по остальным — сам сервис: имя обязано
                # быть однозначным для того, кто его разрешает.
                if key == "WEB_INTERNAL_URL" and printer_nets is None:
                    continue
                caller_nets = printer_nets if key == "WEB_INTERNAL_URL" else networks_of(service)
                caller = printer_name if key == "WEB_INTERNAL_URL" else name
                answers = {f"{path.name}:{other}" for other, spec in services.items()
                           if host in set().union(*names_in(other, spec).values())
                           and networks_of(spec) & caller_nets}
                for net in caller_nets:
                    shared = external_name(compose, net)
                    if shared:
                        answers |= outside.get((shared, host), set())
                assert len(answers) == 1, (
                    f"{path.name}: {name} зовёт {key}={host}, но для {caller} "
                    f"это имя ведёт к {sorted(answers) or 'никому'}"
                )


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
def test_neighbour_hosts_resolve_inside_their_own_networks(path: Path):
    compose = load(path)
    services = compose.get("services") or {}
    outside = shared_aliases()

    for name, service in services.items():
        mine = networks_of(service)
        # что видно этому сервису: имена соседей по общим сетям плюс имена из внешних сетей,
        # где встречаются контуры разных проектов
        visible: set[str] = set()
        for other, spec in services.items():
            for net, aliases in names_in(other, spec).items():
                if net in mine:
                    visible |= aliases
        for net in mine:
            shared = external_name(compose, net)
            if shared:
                visible |= outside.get(shared, set())

        for key, host in hosts(service):
            assert host in visible, (
                f"{path.name}: {name} зовёт {key}={host}, но в сетях {sorted(mine)} такого имени нет. "
                f"Видно: {sorted(visible)}"
            )
