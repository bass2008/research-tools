from playwright.sync_api import expect
from conftest import BASE, ADMIN


def test_create_and_delete_test_task(page):
    response = page.request.post(BASE + '/api/auth/login', data={'email': ADMIN[0], 'password': ADMIN[1]})
    assert response.ok
    page.goto(BASE + '/admin')
    panel = page.get_by_test_id('admin-tasks')
    expect(panel.get_by_test_id('task-add')).to_be_visible()
    # Меню открывается вниз: оставляем под кнопкой место для выбора пункта.
    panel.get_by_test_id('task-add').evaluate("node => node.scrollIntoView({block: 'center'})")
    panel.get_by_test_id('task-add').click()
    page.get_by_test_id('task-add-test').click()
    first = panel.get_by_test_id('admin-task-row').first
    expect(first).to_contain_text('Тестовая задача')
    expect(first).to_have_attribute('data-status', 'queued')
    id = first.locator('td').first.inner_text()
    first.get_by_test_id(f'task-actions-{id}').evaluate("node => node.scrollIntoView({block: 'center'})")
    first.get_by_test_id(f'task-actions-{id}').click()
    page.once('dialog', lambda d: d.accept())
    page.get_by_test_id(f'task-delete-{id}').click()
    expect(panel.get_by_test_id(f'task-actions-{id}')).to_have_count(0)
