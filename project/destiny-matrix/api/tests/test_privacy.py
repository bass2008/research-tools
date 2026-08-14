"""Контракт: дата рождения не уходит в аналитику и не попадает в URL платежа."""


def _schema(client):
    r = client.get("/api/openapi.json")
    assert r.status_code == 200
    return r.json()


def test_birth_never_lives_in_path_or_query(client):
    schema = _schema(client)
    for path, methods in schema["paths"].items():
        assert "birth" not in path, path
        for method, spec in methods.items():
            for param in spec.get("parameters", []):
                assert param["name"] != "birth", (path, method)


def test_birth_never_appears_in_paths_or_query(client):
    """Дата рождения не должна попадать в адрес — ни в путь, ни в параметры.

    В теле POST /payments/mock она допустима: человек покупает разбор именно этой даты,
    и матрица сохраняется по его действию. Запрещён именно адрес, который утекает в логи,
    в реферер и в аналитику.
    """
    schema = client.get("/api/openapi.json").json()
    for path, methods in schema["paths"].items():
        assert "birth" not in path
        for method in methods.values():
            for param in method.get("parameters", []):
                assert param["name"] != "birth"

def test_lead_request_has_no_birth(client):
    schema = _schema(client)
    body = schema["paths"]["/api/leads"]["post"]["requestBody"]
    ref = body["content"]["application/json"]["schema"]["$ref"].rsplit("/", 1)[-1]
    fields = set(schema["components"]["schemas"][ref]["properties"])
    assert fields == {"email", "source"}
