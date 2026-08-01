#!/usr/bin/env python3
"""Браузерные E2E: 18 сценариев из testing-plan §8.

Реальный браузер, реальные клики, живой WebSocket. Фронт — собранный и отданный сервером,
LLM — фальшивый воркер, XMLRiver — режим «только кэш» плюс засеянная выдача.

Против флаки: ожидания ТОЛЬКО по состоянию (`expect(...)` с таймаутом), ни одного
`sleep`/`wait_for_timeout`; каждый сценарий — на свежей засеянной БД (фикстура `instance`).
"""
import re

import pytest
from playwright.sync_api import expect

import seed

FAST = 15_000        # обычное ожидание состояния: клик -> задача -> событие по WS
SLOW = 45_000        # операции с несколькими джобами (drill) и переподключение

expect.set_options(timeout=FAST)


# ---------- помощники (локаторы по data-testid, testing-plan §1.3) ----------

def open_app(page, server, phrase=None):
    """Открыть приложение и дождаться живого WS; при желании — сразу загрузить корень.
    Адрес абсолютный: у каждого сценария свой uvicorn на своём порту."""
    page.set_default_timeout(FAST)
    page.goto(server.url + "/")
    expect(page.get_by_test_id("ws-status")).to_have_text("WS ✓")
    if phrase:
        load_root(page, phrase)


def load_root(page, phrase):
    page.get_by_test_id("root-input").fill(phrase)
    page.get_by_test_id("root-input").press("Enter")
    expect(node(page, phrase)).to_be_visible()


def node(page, phrase):
    return page.get_by_test_id(f"node-{phrase}")


def row(page, phrase):
    """Своя строка узла — без строк его поддерева."""
    return node(page, phrase).locator("> .row")


def status_of(page, phrase):
    return row(page, phrase).locator("[data-testid=node-status]")


def btn(page, phrase, tid):
    return row(page, phrase).locator(f"[data-testid={tid}]")


def toggle(page, phrase):
    return row(page, phrase).locator("[data-testid=node-toggle]")


def tab(page, name):
    page.get_by_test_id(f"tab-{name}").click()


def log_lines(page, text=None):
    lines = page.get_by_test_id("log-line")
    return lines if text is None else lines.filter(has_text=text)


def task_rows(page, text=None):
    rows = page.get_by_test_id("task-row")
    return rows if text is None else rows.filter(has_text=text)


# ---------- 1. Открыть приложение ----------

def test_01_open_app(page, server, worker):
    """§8.1 — 4 вкладки, индикатор LLM-петли и поле корня.

    Кнопки «Загрузить корень» нет: корень задаётся вводом + Enter, а при открытии
    приложение само просит снимок корня по умолчанию (как было в этапе 1-2)."""
    worker.start()
    open_app(page, server)

    for name, label in (("main", "Главная"), ("log", "Лог"), ("tasks", "Task"),
                        ("reports", "Отчёты")):
        expect(page.get_by_test_id(f"tab-{name}")).to_contain_text(label)

    expect(page.get_by_test_id("root-input")).to_be_visible()
    expect(page.get_by_test_id("load-root")).to_have_count(0)

    # индикатор петли: воркер ходит за джобами -> онлайн
    expect(page.get_by_test_id("llm-status")).to_have_text("LLM: онлайн")


# ---------- 2. Загрузить корень ----------

def test_02_load_root_replaces_tree(page, server):
    """§8.2 — «Загрузить корень»: дерево заменилось на это поддерево (snapshot)."""
    open_app(page, server)
    load_root(page, seed.ROOT_A)
    expect(status_of(page, seed.ROOT_A)).to_have_text("FULLY_LOADED")
    expect(node(page, seed.A_ONLINE)).to_be_visible()
    expect(node(page, seed.A_VIDEO)).to_be_visible()

    load_root(page, seed.ROOT_C)                       # snapshot ЗАМЕНЯЕТ дерево целиком
    expect(node(page, seed.C_ONLINE)).to_be_visible()
    expect(node(page, seed.ROOT_A)).to_have_count(0)
    expect(node(page, seed.A_ONLINE)).to_have_count(0)


# ---------- 3. Раскрытие узла и двухцветность ----------

def test_03_expand_two_colors(page, server):
    """§8.3 — `+` дописывает детей; локальные из пула и реально загруженные различимы."""
    open_app(page, server, seed.ROOT_A)

    real, local = toggle(page, seed.A_ONLINE), toggle(page, seed.A_VIDEO)
    expect(real).to_have_class(re.compile(r"\btg-real\b"))     # свой пул (⚡)
    expect(local).to_have_class(re.compile(r"\btg-local\b"))   # локальные из пула родителя

    # синий +: дети дописываются событием children (в локальном пуле этой фразы не было)
    expect(node(page, seed.A_ONLINE_FAST)).to_have_count(0)
    real.click()
    expect(node(page, seed.A_ONLINE_FAST)).to_be_visible()
    expect(node(page, seed.A_ONLINE_FREE)).to_be_visible()

    # серый +: раскрывает локальные, ничего не догружая
    expect(node(page, seed.A_VIDEO_2024)).to_be_hidden()
    local.click()
    expect(node(page, seed.A_VIDEO_2024)).to_be_visible()
    expect(status_of(page, seed.A_VIDEO)).to_have_text("NEW")   # чтение не мутирует


# ---------- 4. «Показать ещё» ----------

def test_04_show_more(page, server):
    """§8.4 — пагинация вширь: первые 120 детей, остальные по кнопке."""
    open_app(page, server, seed.ROOT_B)
    last = node(page, seed.B_LAST)
    expect(node(page, seed.B_FIRST)).to_be_visible()
    expect(last).to_have_count(0)

    more = page.get_by_role("button", name=re.compile("показать ещё"))
    expect(more).to_be_visible()
    more.click()
    expect(last).to_be_visible()


# ---------- 5. Load на узле фронтира ----------

def test_05_load_frontier_node(page, server):
    """§8.5 — `Load`: появились дети, метка сменилась на «загружено»."""
    open_app(page, server, seed.ROOT_A)
    expect(status_of(page, seed.A_VIDEO)).to_have_text("NEW")
    expect(row(page, seed.A_VIDEO).locator(".ct")).to_have_text("1 ↓")   # локальные из пула

    btn(page, seed.A_VIDEO, "btn-load").click()

    expect(status_of(page, seed.A_VIDEO)).to_have_text("LOADED")
    expect(row(page, seed.A_VIDEO).locator(".ct")).to_have_text("2 ↓")   # свой пул, 2 ребёнка
    expect(toggle(page, seed.A_VIDEO)).to_have_class(re.compile(r"\btg-real\b"))
    toggle(page, seed.A_VIDEO).click()
    expect(node(page, seed.A_VIDEO_PHONE)).to_be_visible()


# ---------- 6. Full load: диалог подтверждения ----------

def test_06_full_load_confirm(page, server):
    """§8.6 — оценка объёма в диалоге; «Нет» — ничего, «Да» — операция пошла."""
    open_app(page, server, seed.ROOT_A)
    dlg = page.get_by_test_id("confirm-dialog")

    btn(page, seed.A_VIDEO, "btn-full-load").click()
    expect(dlg).to_be_visible()
    expect(dlg).to_contain_text("Full load")
    expect(dlg).to_contain_text(re.compile(r"не менее ~\d+ узлов / ~\d+ запросов"))

    page.get_by_test_id("confirm-no").click()
    expect(dlg).to_have_count(0)
    expect(status_of(page, seed.A_VIDEO)).to_have_text("NEW")
    tab(page, "tasks")
    expect(task_rows(page)).to_have_count(0)              # «Нет» не поставил задачу
    tab(page, "main")

    btn(page, seed.A_VIDEO, "btn-full-load").click()
    page.get_by_test_id("confirm-yes").click()
    expect(status_of(page, seed.A_VIDEO)).to_have_text("FULLY_LOADED")
    tab(page, "tasks")
    expect(task_rows(page, "full_load").locator(".ts")).to_have_text("DONE")


# ---------- 7. Блокировка узла и поддерева ----------

def test_07_lock_node_and_subtree(page, server, worker):
    """§8.7 — во время операции кнопки узла И поддерева disabled, после — снова активны."""
    worker.start("hold")                                  # держим результат сборки
    open_app(page, server, seed.ROOT_A)
    btn(page, seed.ROOT_A, "btn-needs-build").click()

    expect(btn(page, seed.ROOT_A, "btn-needs-build")).to_be_disabled()
    expect(node(page, seed.ROOT_A)).to_have_class(re.compile(r"\bbusy\b"))
    # поддерево тоже: правило выводится по предкам (tech §6 «Правила»)
    expect(btn(page, seed.A_ONLINE, "btn-needs-build")).to_be_disabled()
    expect(btn(page, seed.A_VIDEO, "btn-load")).to_be_disabled()

    worker.release()

    expect(node(page, seed.ROOT_A)).not_to_have_class(re.compile(r"\bbusy\b"), timeout=SLOW)
    expect(status_of(page, seed.ROOT_A)).to_have_text("FULLY_LOADED")
    expect(btn(page, seed.ROOT_A, "btn-needs-build")).to_be_enabled()
    expect(btn(page, seed.A_VIDEO, "btn-load")).to_be_enabled()


# ---------- 8. Живой прогресс ----------

def test_08_live_progress_without_reload(page, server, worker):
    """§8.8 — прогресс и статусы капают без перезагрузки страницы."""
    worker.start("hold")
    open_app(page, server, seed.ROOT_A)
    page.evaluate("window.__e2e_alive = 1")               # маркер живой страницы
    btn(page, seed.ROOT_A, "btn-needs-build").click()

    prog = page.get_by_test_id("progress")
    expect(prog).to_contain_text("needs")
    expect(prog).to_contain_text("0/1")

    worker.release()

    expect(prog).to_contain_text("1/1")
    expect(node(page, seed.ROOT_A)).not_to_have_class(re.compile(r"\bbusy\b"), timeout=SLOW)
    assert page.evaluate("window.__e2e_alive") == 1, "страница перезагружалась — это не real-time"


# ---------- 9. Загруженная ветка -> сборка дерева потребностей ----------

def test_09_needs_build_from_loaded_branch(page, server, worker):
    """§8.9 — на `FULLY_LOADED` одна команда: собрать потребности. Дерево появляется на
    своей вкладке, статус узла при этом не меняется — второй слой в модель не пишет."""
    worker.start()
    open_app(page, server, seed.ROOT_A)
    expect(status_of(page, seed.ROOT_A)).to_have_text("FULLY_LOADED")

    btn(page, seed.ROOT_A, "btn-needs-build").click()

    tab(page, "tasks")
    expect(task_rows(page, "needs_build").locator(".ts")).to_have_text("DONE", timeout=SLOW)
    tab(page, "needs")
    rows = page.get_by_test_id("needs-row").filter(has_text=seed.ROOT_A)
    expect(rows).to_have_count(2)          # засеянное дерево плюс только что собранное
    tab(page, "main")
    expect(status_of(page, seed.ROOT_A)).to_have_text("FULLY_LOADED")


# ---------- 12. Link открывает отчёт в новой вкладке ----------

def test_12_link_opens_report(page, server):
    """§8.12 — `Link` у РАБОТЫ открывает новую вкладку с готовым HTML; разделы на месте.

    Отчёт принадлежит работе второго слоя, а не узлу дерева запросов."""
    open_app(page, server)
    tab(page, "needs")
    page.get_by_test_id("needs-row").first.click()
    work = page.get_by_test_id("needs-work").filter(has_text=seed.NEEDS_WORK).first
    expect(work.locator("[data-testid=needs-verdict]")).to_contain_text("BUILD")

    work.locator("[data-testid=needs-menu] summary").click()   # отчёты живут в меню действий
    with page.expect_popup() as popup:
        work.locator("[data-testid=needs-report-analyze]").click()
    report = popup.value
    report.wait_for_load_state()

    assert report.url.endswith(f"/reports/{seed.REP_HI_ID}.html"), report.url
    expect(report.locator("h1")).to_have_text(seed.REP_HI)   # засеянный файл отчёта
    for section in seed.REPORT_SECTIONS:
        expect(report.locator("body")).to_contain_text(section)


# ---------- 13. Вкладка Лог ----------

def test_13_log_tab_live_and_clear(page, server, instance):
    """§8.13 — при открытии виден хвост, строки капают живьём, «Удалить всё» чистит."""
    open_app(page, server, seed.A_VIDEO)
    tab(page, "log")
    expect(log_lines(page, "сервер запущен")).to_have_count(1)     # хвост файла при подписке
    tab(page, "main")

    btn(page, seed.A_VIDEO, "btn-load").click()                    # что-нибудь пишущее в лог
    expect(status_of(page, seed.A_VIDEO)).to_have_text("LOADED")

    tab(page, "log")
    expect(log_lines(page, "load").first).to_be_visible()          # живой поток
    assert "load" in server.log_text()                             # и то же самое в файле

    page.get_by_test_id("log-clear").click()
    expect(log_lines(page)).to_have_count(0)
    assert "load" not in server.log_text(), "очистка не тронула лог-файл"


# ---------- 14. Вкладка Task ----------

def test_14_task_tab(page, server, worker):
    """§8.14 — строки задач со статусами; групповая задача подписана корнем поддерева."""
    worker.start()
    open_app(page, server, seed.ROOT_A)

    btn(page, seed.A_VIDEO, "btn-load").click()
    expect(status_of(page, seed.A_VIDEO)).to_have_text("LOADED")
    btn(page, seed.ROOT_A, "btn-needs-build").click()

    tab(page, "tasks")
    expect(task_rows(page)).to_have_count(2)
    load_row = task_rows(page, seed.A_VIDEO)
    expect(load_row).to_contain_text("load")
    expect(load_row.locator(".ts")).to_have_text("DONE")
    # операция по всей ветке — одна строка, подписана корнем ветки (читаемо, tech §4)
    group = task_rows(page, "needs_build")
    expect(group).to_contain_text(seed.ROOT_A)
    expect(group.locator(".ts")).to_have_text("DONE", timeout=SLOW)


# ---------- 15. Вкладка Отчёты ----------

def test_15_reports_tab_sorted(page, server):
    """§8.15 — отчёты РАБОТ, по убыванию verdict_score; ссылка открывает готовый файл."""
    open_app(page, server)
    tab(page, "reports")

    rows = page.get_by_test_id("report-row")
    expect(rows).to_have_count(2)
    expect(rows.nth(0)).to_contain_text(seed.NEEDS_WORK)        # 91 выше
    expect(rows.nth(0)).to_contain_text(str(seed.REP_HI_SCORE))
    expect(rows.nth(1)).to_contain_text(seed.NEEDS_GAP_WORK)    # 42 ниже
    # у каждой строки видно, по какой ветке собрана работа
    expect(rows.nth(0)).to_contain_text(seed.ROOT_A)

    with page.expect_popup() as popup:
        rows.nth(0).locator("[data-testid=report-link]").click()
    assert popup.value.url.endswith(f"/reports/{seed.REP_HI_ID}.html")


# ---------- 16. Упавшая операция ----------

def test_16_failed_op_keeps_status(page, server, worker):
    """§8.16 — ошибка видна в логе, статус узла не изменился, кнопки разблокированы."""
    worker.start("error")
    open_app(page, server, seed.ROOT_A)
    btn(page, seed.ROOT_A, "btn-needs-build").click()

    tab(page, "tasks")
    expect(task_rows(page, "needs_build").locator(".ts")).to_have_text("FAILED", timeout=SLOW)
    tab(page, "log")
    expect(log_lines(page, "намеренная ошибка").first).to_be_visible()

    tab(page, "main")
    expect(status_of(page, seed.ROOT_A)).to_have_text("FULLY_LOADED")   # узел остался как был
    expect(btn(page, seed.ROOT_A, "btn-needs-build")).to_be_enabled()
    expect(btn(page, seed.A_VIDEO, "btn-load")).to_be_enabled()


# ---------- 17. Перезапуск сервера при открытой странице ----------

def test_17_reconnect_after_restart(page, server, worker):
    """§8.17 — клиент переподключился, дерево живое, зависших блокировок нет."""
    worker.start("hold")
    open_app(page, server, seed.ROOT_A)
    btn(page, seed.ROOT_A, "btn-needs-build").click()
    expect(btn(page, seed.ROOT_A, "btn-needs-build")).to_be_disabled()     # узел заблокирован

    server.restart()

    expect(page.get_by_test_id("ws-status")).to_have_text("WS ✓", timeout=SLOW)
    expect(node(page, seed.ROOT_A)).to_be_visible()                    # дерево перезапрошено
    expect(node(page, seed.A_ONLINE)).to_be_visible()
    expect(status_of(page, seed.ROOT_A)).to_have_text("FULLY_LOADED", timeout=SLOW)
    expect(btn(page, seed.ROOT_A, "btn-needs-build")).to_be_enabled(timeout=SLOW)

    worker.release()          # опоздавший результат: сервер жив, задача не воскресает
    tab(page, "log")
    expect(log_lines(page, "ОТБРОШЕН").first).to_be_visible(timeout=SLOW)
    tab(page, "main")
    expect(page.get_by_test_id("ws-status")).to_have_text("WS ✓")
    expect(status_of(page, seed.ROOT_A)).to_have_text("FULLY_LOADED")


# ---------- 18. Петля LLM не запущена ----------

@pytest.mark.server_env(E2E_LLM_TIMEOUT="4")
def test_18_llm_offline(page, server):
    """§8.18 — индикатор «офлайн»; LLM-операция падает по таймауту с внятным логом."""
    open_app(page, server, seed.ROOT_A)                     # фальшивый воркер НЕ запущен
    llm = page.get_by_test_id("llm-status")
    expect(llm).to_have_text("LLM: офлайн")
    expect(llm).to_have_attribute("title", "петля ещё не приходила за задачами")

    btn(page, seed.ROOT_A, "btn-needs-build").click()

    tab(page, "log")
    expect(log_lines(page, "LLM-петля не на связи")).to_have_count(1)
    expect(log_lines(page, "таймаут ожидания результата LLM").first).to_be_visible(timeout=SLOW)

    tab(page, "tasks")
    expect(task_rows(page, "needs_build").locator(".ts")).to_have_text("FAILED", timeout=SLOW)
    tab(page, "main")
    expect(status_of(page, seed.ROOT_A)).to_have_text("FULLY_LOADED")   # узел не тронут
    expect(btn(page, seed.ROOT_A, "btn-needs-build")).to_be_enabled()


# ---------- 19. Вкладка «Дерево потребностей» ----------

def test_19_needs_tree_tab(page, server):
    """§8.19 — таблица деревьев из папки; клик открывает дерево, «Назад» возвращает.

    Второй слой конвейером не производится: дерево лежит файлом, поэтому проверяем показ —
    работы с частотами, щель, занятость, раскрытие фраз и сегмента."""
    open_app(page, server)
    tab(page, "needs")

    rows = page.get_by_test_id("needs-row")
    expect(rows).to_have_count(1)
    expect(rows.first).to_contain_text(seed.NEEDS_ID)
    expect(rows.first).to_contain_text(seed.ROOT_A)
    expect(page.get_by_test_id("needs-tree")).to_have_count(0)

    rows.first.click()

    tree = page.get_by_test_id("needs-tree")
    expect(tree).to_be_visible()
    expect(page.get_by_test_id("needs-condition")).to_contain_text("онлайн · бесплатно")
    expect(rows).to_have_count(0)                       # таблицы больше нет

    works = page.get_by_test_id("needs-work")
    expect(works).to_have_count(2)
    first = works.filter(has_text=seed.NEEDS_WORK).first
    expect(first.locator("[data-testid=needs-occupied]")).to_contain_text(seed.NEEDS_OCCUPIED)
    gap = works.filter(has_text=seed.NEEDS_GAP_WORK).first
    expect(gap.locator("[data-testid=needs-gap]")).to_have_text("ЩЕЛЬ")

    # фразы появляются только по клику, вместе с сегментом
    expect(page.get_by_test_id("needs-phrase")).to_have_count(0)
    first.locator("[data-testid=needs-toggle]").click()
    expect(first.get_by_test_id("needs-phrase")).to_have_count(4)   # 3 свои + 1 из сегмента
    expect(first.get_by_test_id("needs-segment")).to_contain_text(seed.NEEDS_SEGMENT)
    expect(first.get_by_test_id("needs-phrase").first).to_contain_text("1 000")

    # исключённые фразы — отдельным раскрытием
    page.get_by_test_id("needs-excluded-toggle").click()
    expect(page.get_by_test_id("needs-excluded")).to_contain_text("условие")

    page.get_by_test_id("needs-back").click()
    expect(rows).to_have_count(1)
    expect(page.get_by_test_id("needs-tree")).to_have_count(0)
